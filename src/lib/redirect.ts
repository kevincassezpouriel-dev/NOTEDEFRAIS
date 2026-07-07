import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "./prisma";
import { detectDevice, detectLanguage } from "./detect";
import { anonymizeIp, getClientIp } from "./ip";
import { geolocate } from "./geo";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Cœur du système : reçoit un scan sur /r/{slug} (ou /download),
 * choisit la destination selon l'appareil et enregistre l'événement
 * APRÈS avoir envoyé la redirection (aucune latence ajoutée au scan).
 *
 * Redirection en 302 (jamais 301) : les URLs de destination restent
 * modifiables dans l'admin sans que les navigateurs mettent en cache
 * l'ancienne cible.
 */
export async function handleScanRedirect(req: NextRequest, slug: string) {
  let qr = await prisma.qrCode.findUnique({ where: { slug } });

  // Le QR par défaut (/download) est créé automatiquement au premier scan
  // pour que la plateforme fonctionne sans configuration préalable.
  if (!qr && slug === "download") {
    qr = await prisma.qrCode
      .create({
        data: {
          name: "QR principal",
          slug: "download",
          appStoreUrl: "",
          playStoreUrl: "",
          fallbackUrl: "",
        },
      })
      .catch(() => prisma.qrCode.findUnique({ where: { slug } }));
  }

  const origin = req.nextUrl.origin;
  const presentation = `${origin}/app`;

  if (!qr || !qr.active) {
    return NextResponse.redirect(presentation, { status: 302, headers: NO_CACHE });
  }

  const device = detectDevice(req.headers.get("user-agent"));
  const fallback = qr.fallbackUrl || presentation;

  let target = fallback;
  let redirectedTo = "fallback";
  if ((device.deviceType === "iphone" || device.deviceType === "ipad") && qr.appStoreUrl) {
    target = qr.appStoreUrl;
    redirectedTo = "appstore";
  } else if (device.deviceType === "android" && qr.playStoreUrl) {
    target = qr.playStoreUrl;
    redirectedTo = "playstore";
  }

  const qrId = qr.id;
  const language = detectLanguage(req.headers);
  const referrer =
    req.nextUrl.searchParams.get("utm_source") ?? req.headers.get("referer");
  const ip = getClientIp(req.headers);
  const headers = new Headers(req.headers);

  // Tracking après l'envoi de la réponse : le scan reste instantané même
  // si la géolocalisation est lente ou en panne.
  if (!device.isBot) {
    after(async () => {
      try {
        const geo = await geolocate(headers, ip);
        await prisma.scanEvent.create({
          data: {
            qrCodeId: qrId,
            ipAnonymized: anonymizeIp(ip),
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            latitude: geo.latitude,
            longitude: geo.longitude,
            deviceType: device.deviceType,
            os: device.os,
            browser: device.browser,
            language,
            referrer: referrer?.slice(0, 500) ?? null,
            redirectedTo,
          },
        });
        await applyRetention();
      } catch (err) {
        console.error("Erreur d'enregistrement du scan :", err);
      }
    });
  }

  return NextResponse.redirect(target, { status: 302, headers: NO_CACHE });
}

/** Rétention RGPD : purge les scans plus vieux que RETENTION_DAYS (si défini). */
async function applyRetention() {
  const days = Number(process.env.RETENTION_DAYS);
  if (!Number.isFinite(days) || days <= 0) return;
  // Échantillonnage : inutile de purger à chaque scan
  if (Math.random() > 0.05) return;
  const limit = new Date(Date.now() - days * 86_400_000);
  await prisma.scanEvent.deleteMany({ where: { createdAt: { lt: limit } } });
}
