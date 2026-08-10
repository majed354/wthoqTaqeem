type EnvironmentGlobal = typeof globalThis & {
  Netlify?: { env: { get(name: string): string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

type GoogleTextSearchResponse = {
  places?: Array<{ id?: string }>;
};

type GooglePlaceResponse = {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  types?: string[];
};

class PublicError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getEnvironmentVariable(name: string) {
  const runtime = globalThis as EnvironmentGlobal;
  return runtime.Netlify?.env.get(name) ?? runtime.process?.env?.[name];
}

function isAllowedGoogleMapsHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "maps.app.goo.gl" || host === "goo.gl") return true;
  if (host === "google.com" || host.endsWith(".google.com")) return true;

  const countryDomain = host.match(/^(?:(?:www|maps)\.)?google\.(.+)$/)?.[1];
  if (!countryDomain) return false;
  return /^[a-z]{2}$/.test(countryDomain) || /^(?:com|co)\.[a-z]{2}$/.test(countryDomain);
}

function parseGoogleMapsUrl(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 8 || value.length > 2_048) {
    throw new PublicError("ألصق رابطًا صالحًا للمنشأة من Google Maps.");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PublicError("صيغة الرابط غير صحيحة.");
  }

  if (url.protocol !== "https:" || !isAllowedGoogleMapsHost(url.hostname)) {
    throw new PublicError("نقبل حاليًا روابط Google Maps الآمنة فقط.");
  }

  if (url.hostname === "goo.gl" && !url.pathname.startsWith("/maps")) {
    throw new PublicError("هذا ليس رابط Google Maps.");
  }

  return url;
}

function decodeUrlPart(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim() || undefined;
  } catch {
    return value.trim() || undefined;
  }
}

function extractPlaceId(url: URL) {
  const parameterId = url.searchParams.get("query_place_id") ?? url.searchParams.get("place_id");
  if (parameterId) return decodeUrlPart(parameterId);

  const dataMatch = url.href.match(/!1s([^!/?#]+)/);
  const decoded = decodeUrlPart(dataMatch?.[1]);
  return decoded?.startsWith("ChIJ") ? decoded : undefined;
}

function extractSearchText(url: URL) {
  const parameterQuery = url.searchParams.get("query") ?? url.searchParams.get("q");
  if (parameterQuery) return decodeUrlPart(parameterQuery);

  const segments = url.pathname.split("/").filter(Boolean);
  const placeIndex = segments.findIndex((segment) => segment === "place");
  if (placeIndex >= 0) return decodeUrlPart(segments[placeIndex + 1]);
  return undefined;
}

function extractCoordinates(url: URL) {
  const atMatch = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const dataMatch = url.href.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  const match = atMatch ?? dataMatch;
  if (!match) return undefined;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

async function resolveShortUrl(url: URL) {
  if (url.hostname !== "maps.app.goo.gl" && url.hostname !== "goo.gl") return url;

  let currentUrl = url;
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Wthoq/0.2)" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PublicError("تعذر فتح رابط Google Maps المختصر. حاول مرة أخرى.", 502);
    }

    if (response.status < 300 || response.status >= 400) return parseGoogleMapsUrl(currentUrl.href);

    const location = response.headers.get("location");
    if (!location) throw new PublicError("لم يعرض الرابط المختصر وجهته.", 502);
    currentUrl = parseGoogleMapsUrl(new URL(location, currentUrl).href);
  }

  throw new PublicError("تجاوز رابط Google Maps عدد التحويلات المسموح به.", 502);
}

async function findPlaceId(url: URL, apiKey: string) {
  const existingId = extractPlaceId(url);
  if (existingId) return existingId;

  const textQuery = extractSearchText(url);
  if (!textQuery) {
    throw new PublicError("لم نتمكن من تحديد اسم المنشأة من الرابط. افتح صفحة المنشأة نفسها ثم انسخ رابط المشاركة.");
  }

  const coordinates = extractCoordinates(url);
  const requestBody: Record<string, unknown> = {
    textQuery,
    languageCode: "ar",
    regionCode: "SA",
    pageSize: 1,
  };

  if (coordinates) {
    requestBody.locationBias = {
      circle: { center: coordinates, radius: 250 },
    };
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new PublicError("تعذر البحث عن المنشأة. تحقق من تفعيل Places API (New) وصلاحية المفتاح.", 502);
  }

  const result = (await response.json()) as GoogleTextSearchResponse;
  const placeId = result.places?.[0]?.id;
  if (!placeId) throw new PublicError("لم نجد منشأة مطابقة لهذا الرابط.", 404);
  return placeId;
}

function findCity(components: GooglePlaceResponse["addressComponents"]) {
  const preferredTypes = ["locality", "administrative_area_level_2", "administrative_area_level_1"];
  for (const type of preferredTypes) {
    const match = components?.find((component) => component.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return undefined;
}

async function fetchPlace(placeId: string, apiKey: string) {
  const fields = [
    "id",
    "displayName",
    "primaryTypeDisplayName",
    "formattedAddress",
    "addressComponents",
    "rating",
    "userRatingCount",
    "googleMapsUri",
    "types",
  ].join(",");

  const endpoint = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  endpoint.searchParams.set("languageCode", "ar");
  endpoint.searchParams.set("regionCode", "SA");

  const response = await fetch(endpoint, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new PublicError("تعذر استيراد تفاصيل المنشأة. تحقق من إعدادات مفتاح Google.", 502);
  }

  const result = (await response.json()) as GooglePlaceResponse;
  if (!result.id || !result.displayName?.text) {
    throw new PublicError("استجاب Google دون بيانات كافية عن المنشأة.", 502);
  }

  return {
    id: result.id,
    name: result.displayName.text,
    category: result.primaryTypeDisplayName?.text ?? "منشأة",
    city: findCity(result.addressComponents),
    address: result.formattedAddress,
    rating: typeof result.rating === "number" ? result.rating : null,
    userRatingCount: typeof result.userRatingCount === "number" ? result.userRatingCount : 0,
    googleMapsUri: result.googleMapsUri,
  };
}

export default async function handler(request: Request) {
  if (request.method !== "POST") return json({ error: "الطريقة غير مدعومة." }, 405);

  try {
    const apiKey = getEnvironmentVariable("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      throw new PublicError("خدمة الاستيراد غير مهيأة بعد. أضف GOOGLE_MAPS_API_KEY إلى متغيرات Netlify.", 503);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PublicError("تعذر قراءة الطلب.");
    }

    const submittedUrl = parseGoogleMapsUrl((body as { url?: unknown })?.url);
    const resolvedUrl = await resolveShortUrl(submittedUrl);
    const placeId = await findPlaceId(resolvedUrl, apiKey);
    const place = await fetchPlace(placeId, apiKey);
    return json({ place });
  } catch (error) {
    if (error instanceof PublicError) return json({ error: error.message }, error.status);
    return json({ error: "حدث خطأ غير متوقع أثناء استيراد بيانات المنشأة." }, 500);
  }
}
