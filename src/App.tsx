import { useMemo, useState } from "react";
import type { FormEvent } from "react";

type Mode = "single" | "compare";
type AnalysisState = "idle" | "loading" | "done";
type AnalysisSource = "live" | "demo" | null;

type PlaceData = {
  id: string;
  name: string;
  category: string;
  city?: string;
  address?: string;
  rating: number | null;
  userRatingCount: number;
  googleMapsUri?: string;
};

type PreliminaryAssessment = {
  adjustedRating: number | null;
  sampleStrength: number;
  sampleLabel: string;
  qualityLabel: string;
  decision: string;
};

const demoPlace: PlaceData = {
  id: "demo-place",
  name: "المكان التجريبي",
  category: "مطعم",
  city: "الرياض",
  address: "بيانات محاكاة للتعريف بالمنهجية",
  rating: 4.9,
  userRatingCount: 120,
};

const demoCompetitor: PlaceData = {
  id: "demo-competitor",
  name: "المنافس المستقر",
  category: "مطعم",
  city: "الرياض",
  rating: 4.7,
  userRatingCount: 186,
};

const signals = [
  {
    level: "مرتفع",
    tone: "high",
    title: "دفعة زمنية غير معتادة",
    detail: "31 تقييمًا بخمس نجوم ظهرت خلال 5 أيام، ثم عاد النشاط إلى معدله السابق.",
    impact: "+18",
  },
  {
    level: "مرتفع",
    tone: "high",
    title: "قوالب نصية متشابهة",
    detail: "14 مراجعة تجمعت في 3 صيغ متقاربة مع ترتيب مدح متكرر.",
    impact: "+16",
  },
  {
    level: "متوسط",
    tone: "medium",
    title: "تزامن بين مراجعين",
    detail: "9 مراجعين ظهروا معًا في منشأتين أخريين ضمن نوافذ زمنية متقاربة.",
    impact: "+24",
  },
];

const steps = [
  ["01", "نفك الرابط", "نتعرف على المنشأة والفرع ومصدر التقييمات."],
  ["02", "نقيس الإشارات", "نحلل الزمن والنصوص والشبكات دون أحكام شخصية."],
  ["03", "نصحح التقييم", "نعيد وزن المراجعات ونوضح أثر كل إشارة."],
];

function scrollToResults() {
  window.setTimeout(() => {
    document.getElementById("النتيجة")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

async function importPlace(url: string) {
  const response = await fetch("/api/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const payload = (await response.json().catch(() => ({}))) as { place?: PlaceData; error?: string };
  if (!response.ok || !payload.place) {
    throw new Error(payload.error ?? "تعذر استيراد بيانات المنشأة. حاول مرة أخرى.");
  }
  return payload.place;
}

function formatRating(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

function formatCount(value: number) {
  return value.toLocaleString("ar-SA");
}

function assessPlace(place: PlaceData): PreliminaryAssessment {
  const count = Math.max(0, place.userRatingCount);
  const sampleStrength = Math.round(100 * (1 - Math.exp(-count / 100)));
  const sampleLabel = sampleStrength >= 80 ? "قوية" : sampleStrength >= 55 ? "متوسطة" : "محدودة";

  if (place.rating === null) {
    return {
      adjustedRating: null,
      sampleStrength,
      sampleLabel,
      qualityLabel: "لا تتوفر درجة جودة",
      decision: "لا توجد بيانات كافية لإصدار قراءة أولية.",
    };
  }

  // تصحيح محافظ: نضيف 20 تقييمًا افتراضيًا بمتوسط 4.0 لتقليل أثر العينات الصغيرة.
  const priorMean = 4;
  const priorWeight = 20;
  const adjustedRating = (place.rating * count + priorMean * priorWeight) / (count + priorWeight);
  const qualityLabel =
    adjustedRating >= 4.6
      ? "جودة ظاهرة ممتازة"
      : adjustedRating >= 4.3
        ? "جودة ظاهرة قوية"
        : adjustedRating >= 4
          ? "جودة ظاهرة جيدة"
          : adjustedRating >= 3.5
            ? "جودة ظاهرة متوسطة"
            : "إشارة جودة منخفضة";

  const decision =
    adjustedRating >= 4.5 && count >= 100
      ? "إشارة جودة قوية، مع تحقق إضافي قبل الشراء."
      : adjustedRating >= 4.2 && count >= 30
        ? "إشارة جودة إيجابية، لكن قارن التجارب الحديثة قبل القرار."
        : "لا تعتمد على النجوم وحدها؛ يلزم تحقق مباشر قبل القرار.";

  return { adjustedRating, sampleStrength, sampleLabel, qualityLabel, decision };
}

export default function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>(null);
  const [placeData, setPlaceData] = useState<PlaceData | null>(null);
  const [competitorPlaceData, setCompetitorPlaceData] = useState<PlaceData | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [suspiciousWeight, setSuspiciousWeight] = useState(15);
  const [copied, setCopied] = useState(false);

  const trustedScore = useMemo(() => {
    return (4.39 + suspiciousWeight * 0.003).toFixed(2);
  }, [suspiciousWeight]);

  const canAnalyze =
    primaryUrl.trim().length > 5 && (mode === "single" || competitorUrl.trim().length > 5);
  const isLiveResult = analysisSource === "live";
  const preliminaryAssessment = useMemo(
    () => (placeData ? assessPlace(placeData) : null),
    [placeData],
  );

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze) return;

    setAnalysisError("");
    setAnalysisState("loading");
    setAnalysisSource(null);
    setPlaceData(null);
    setCompetitorPlaceData(null);

    try {
      const requests = [importPlace(primaryUrl.trim())];
      if (mode === "compare") requests.push(importPlace(competitorUrl.trim()));
      const [primary, competitor] = await Promise.all(requests);

      setPlaceData(primary);
      setCompetitorPlaceData(competitor ?? null);
      setAnalysisSource("live");
      setAnalysisState("done");
      scrollToResults();
    } catch (error) {
      setAnalysisState("idle");
      setAnalysisError(error instanceof Error ? error.message : "تعذر استيراد البيانات.");
    }
  }

  function loadExample() {
    setPrimaryUrl("https://maps.app.goo.gl/wothoq-demo-a");
    if (mode === "compare") setCompetitorUrl("https://maps.app.goo.gl/wothoq-demo-b");
    setAnalysisError("");
    setPlaceData(demoPlace);
    setCompetitorPlaceData(mode === "compare" ? demoCompetitor : null);
    setAnalysisSource("demo");
    setAnalysisState("done");
    scrollToResults();
  }

  async function copySummary() {
    if (!placeData) return;
    const summary = isLiveResult
      ? `وثوق — قراءة أولية\n${placeData.name}\n${placeData.category}${placeData.city ? ` · ${placeData.city}` : ""}\nتقييم Google: ${formatRating(placeData.rating)}/5 من ${formatCount(placeData.userRatingCount)} تقييمًا\nالتقييم المرجح أوليًا: ${formatRating(preliminaryAssessment?.adjustedRating ?? null)}/5\nالخلاصة: ${preliminaryAssessment?.decision ?? "لا توجد بيانات كافية."}\nأصالة المراجعات: غير محسومة دون بيانات تفصيلية`
      : `وثوق — تحليل تجريبي\nتقييم Google: 4.90/5\nالتقييم الموثوق الحالي: ${trustedScore}/5\nخطر التلاعب: 76/100\nالثقة في التحليل: منخفضة`;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#الرئيسية" aria-label="وثوق — الرئيسية">
          <span className="brand-mark" aria-hidden="true">و</span>
          <span>
            <strong>وثوق</strong>
            <small>رؤية أوضح خلف النجوم</small>
          </span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          <a href="#كيف-يعمل">كيف يعمل؟</a>
          <a href="#المنهجية">المنهجية</a>
          <span className="version-chip">تجريبي · v0.3</span>
        </nav>
      </header>

      <section className="hero" id="الرئيسية">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true" /> مؤشر موثوقية تقييمات Google</p>
          <h1>لا تجعل <em>4.9</em><br />تخدعك.</h1>
          <p className="hero-lead">
            وثوق لا يدّعي معرفة الكاذب. نبحث عن أنماط التلاعب، نعيد وزن التقييمات،
            ونريك الرقم الأقرب إلى الجودة المستقرة.
          </p>
          <div className="hero-proof" aria-label="مبادئ وثوق">
            <span>لا أحكام فردية</span>
            <span>أسباب قابلة للفحص</span>
            <span>الثقة منفصلة عن الاشتباه</span>
          </div>
        </div>

        <form className="analyzer" onSubmit={submitAnalysis}>
          <div className="analyzer-topline">
            <div>
              <span className="live-dot" aria-hidden="true" />
              <strong>استيراد مباشر</strong>
            </div>
            <span>Google Places</span>
          </div>

          <div className="mode-switch" role="tablist" aria-label="نوع التحليل">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              className={mode === "single" ? "active" : ""}
              onClick={() => {
                setMode("single");
                setAnalysisError("");
              }}
            >
              منشأة واحدة
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "compare"}
              className={mode === "compare" ? "active" : ""}
              onClick={() => {
                setMode("compare");
                setAnalysisError("");
              }}
            >
              مقارنة منافسين
            </button>
          </div>

          <label htmlFor="primary-url">رابط المنشأة من Google Maps</label>
          <div className="url-field">
            <span className="link-icon" aria-hidden="true">↗</span>
            <input
              id="primary-url"
              type="url"
              inputMode="url"
              placeholder="الصق رابط maps.app.goo.gl"
              value={primaryUrl}
              onChange={(event) => {
                setPrimaryUrl(event.target.value);
                setAnalysisError("");
              }}
              required
            />
          </div>

          {mode === "compare" && (
            <div className="competitor-field">
              <label htmlFor="competitor-url">رابط المنافس</label>
              <div className="url-field">
                <span className="link-icon" aria-hidden="true">↗</span>
                <input
                  id="competitor-url"
                  type="url"
                  inputMode="url"
                  placeholder="الصق رابط المنافس"
                  value={competitorUrl}
                  onChange={(event) => {
                    setCompetitorUrl(event.target.value);
                    setAnalysisError("");
                  }}
                  required
                />
              </div>
            </div>
          )}

          {analysisError && <p className="form-error" role="alert">{analysisError}</p>}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!canAnalyze || analysisState === "loading"}>
              {analysisState === "loading" ? "جارٍ استيراد البيانات…" : mode === "compare" ? "استورد وقارن" : "استورد البيانات"}
              <span aria-hidden="true">←</span>
            </button>
            <button className="text-button" type="button" onClick={loadExample}>جرّب مثالًا</button>
          </div>

          <p className="form-note">
            نستورد هوية المنشأة والتقييم وعدده من Google. درجة الوثوق الكاملة تحتاج بيانات مراجعات موسعة.
          </p>
        </form>
      </section>

      {analysisState === "loading" && (
        <section className="analysis-loader" aria-live="polite" aria-label="جارٍ الاستيراد">
          <div className="scan-orbit"><span /></div>
          <div>
            <strong>نتحقق من الرابط ونحدد المنشأة…</strong>
            <p>فتح الرابط ← مطابقة المكان ← استيراد بيانات Google الرسمية</p>
          </div>
        </section>
      )}

      {analysisState === "done" && placeData && (
        <section className="results-section" id="النتيجة">
          <div className="section-heading result-heading">
            <div>
              <p className="eyebrow light"><span aria-hidden="true" /> {isLiveResult ? "بيانات مستوردة" : "نتيجة تجريبية"}</p>
              <h2>{isLiveResult ? "قراءة أولية تساعدك على القرار." : mode === "compare" ? "المقارنة تكشف الفارق." : "الرقم الخام لا يروي القصة كاملة."}</h2>
            </div>
            <button className="copy-button" type="button" onClick={copySummary}>
              {copied ? "تم النسخ ✓" : "نسخ الملخص"}
            </button>
          </div>

          <div className="report-card">
            <div className="report-identity">
              <div className="place-icon" aria-hidden="true">{placeData.name.trim().charAt(0) || "م"}</div>
              <div>
                <small>{placeData.category}{placeData.city ? ` · ${placeData.city}` : ""}</small>
                <h3>{placeData.name}</h3>
                <p>{placeData.address ?? "تم التعرف على المنشأة من رابط Google Maps"}</p>
              </div>
              <span className={`confidence-badge ${isLiveResult ? "google-badge" : ""}`}>
                {isLiveResult ? "بيانات Google" : "ثقة منخفضة"}
              </span>
            </div>

            <div className="score-grid">
              <article className="score-card raw-score">
                <span>تقييم Google الخام</span>
                <div><strong>{formatRating(placeData.rating)}</strong><small>/ 5</small></div>
                <p>{formatCount(placeData.userRatingCount)} تقييمًا ظاهرًا</p>
              </article>

              {isLiveResult ? (
                <>
                  <article className="score-card trusted-score preliminary-score">
                    <span>التقييم المرجّح أوليًا</span>
                    <div><strong>{formatRating(preliminaryAssessment?.adjustedRating ?? null)}</strong><small>/ 5</small></div>
                    <p>تصحيح محافظ يقلل أثر العينات الصغيرة؛ لا يثبت أصالة المراجعات.</p>
                  </article>
                  <article className="risk-card live-pending-card">
                    <div className="risk-gauge pending" role="img" aria-label="بيانات الموثوقية جزئية">
                      <div><strong className="word-value">جزئي</strong></div>
                    </div>
                    <div>
                      <span>حكم أصالة المراجعات</span>
                      <strong>غير محسوم</strong>
                      <p>Google يتيح المتوسط والحجم، ولا يعيد السجل الكامل اللازم لكشف التنسيق.</p>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="score-card trusted-score">
                    <span>التقييم الموثوق الحالي</span>
                    <div><strong>{trustedScore}</strong><small>/ 5</small></div>
                    <p>نطاق الثقة 4.29 – 4.56</p>
                  </article>
                  <article className="risk-card">
                    <div className="risk-gauge" role="img" aria-label="خطر التلاعب 76 من 100">
                      <div><strong>76</strong><small>/100</small></div>
                    </div>
                    <div>
                      <span>خطر التلاعب</span>
                      <strong>إشارات تنسيق مرتفعة</strong>
                      <p>مصدران مستقلان على الأقل</p>
                    </div>
                  </article>
                </>
              )}
            </div>

            {isLiveResult ? (
              <>
                <div className="coverage-row live-coverage">
                  <div>
                    <span>قوة العينة رقميًا</span>
                    <strong>{preliminaryAssessment?.sampleStrength ?? 0}<small>/100 · {preliminaryAssessment?.sampleLabel}</small></strong>
                  </div>
                  <div className="coverage-track" aria-hidden="true"><span style={{ width: `${preliminaryAssessment?.sampleStrength ?? 0}%` }} /></div>
                  <p>كثرة التقييمات تجعل المتوسط أكثر استقرارًا إحصائيًا، لكنها لا تثبت أن المراجعات أصلية.</p>
                </div>

                <div className="evidence-block live-evidence">
                  <div className="evidence-title">
                    <div>
                      <span>الخلاصة الأولية</span>
                      <h4>{preliminaryAssessment?.qualityLabel}</h4>
                    </div>
                    <span className="evidence-count">قرار مبدئي</span>
                  </div>
                  <div className="decision-banner">
                    <span>القرار الحالي</span>
                    <strong>{preliminaryAssessment?.decision}</strong>
                    <p>افحص صور الأعمال الحديثة، واقرأ التقييمات الأقل نجومًا، واطلب ضمانًا مكتوبًا قبل الالتزام المالي.</p>
                  </div>
                  <div className="imported-fields">
                    <article>
                      <strong>✓ تقييم مرجّح</strong>
                      <p>أضفنا 20 تقييمًا افتراضيًا بمتوسط 4.0 لتقليل تضخيم العينات الصغيرة.</p>
                    </article>
                    <article>
                      <strong>✓ حجم العينة</strong>
                      <p>{formatCount(placeData.userRatingCount)} تقييمًا تمنح المتوسط قوة رقمية {preliminaryAssessment?.sampleLabel}.</p>
                    </article>
                    <article className="unresolved-field">
                      <strong>! الأصالة غير محسومة</strong>
                      <p>نحتاج النصوص والتواريخ وتوزيع النجوم وسجل المراجعين حتى نحسب خطر التلاعب.</p>
                    </article>
                  </div>
                  {placeData.googleMapsUri && (
                    <a className="maps-link" href={placeData.googleMapsUri} target="_blank" rel="noreferrer">
                      فتح المنشأة في Google Maps <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="coverage-row">
                  <div>
                    <span>المراجعات الفعّالة</span>
                    <strong>68 <small>من 120</small></strong>
                  </div>
                  <div className="coverage-track" aria-hidden="true"><span /></div>
                  <p>نخفض الوزن ولا نحذف المراجعات حذفًا حادًا.</p>
                </div>

                <div className="evidence-block">
                  <div className="evidence-title">
                    <div>
                      <span>لماذا تغيّر التقييم؟</span>
                      <h4>أبرز الإشارات المؤثرة</h4>
                    </div>
                    <span className="evidence-count">3 إشارات</span>
                  </div>
                  <div className="signal-list">
                    {signals.map((signal) => (
                      <article className="signal" key={signal.title}>
                        <span className={`signal-level ${signal.tone}`}>{signal.level}</span>
                        <div>
                          <h5>{signal.title}</h5>
                          <p>{signal.detail}</p>
                        </div>
                        <strong>{signal.impact}</strong>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="sensitivity-card">
                  <div>
                    <span>اختبر أثر القرار</span>
                    <h4>وزن المراجعات عالية الاشتباه</h4>
                    <p>لا نقرر أنها وهمية؛ غيّر وزنها وشاهد أثر الافتراض على النتيجة.</p>
                  </div>
                  <div className="range-control">
                    <output>{suspiciousWeight}%</output>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={suspiciousWeight}
                      onChange={(event) => setSuspiciousWeight(Number(event.target.value))}
                      aria-label="وزن المراجعات عالية الاشتباه"
                    />
                    <div><span>استبعاد شبه كامل</span><span>الوزن الأصلي</span></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {mode === "compare" && competitorPlaceData && (
            <div className="comparison-card">
              <div className="comparison-intro">
                <span>{isLiveResult ? "مقارنة البيانات الخام" : "الترتيب بعد التصحيح"}</span>
                <h3>{isLiveResult ? "منشأتان من رابطين حقيقيين." : "الاستقرار يتفوق على الرقم الأعلى."}</h3>
                <p>{isLiveResult ? "نعرض الآن بيانات Google فقط، دون ترتيب موثوقية غير مدعوم." : "نرتب بالحد الأدنى لنطاق الثقة، لا بالمتوسط الخام وحده."}</p>
              </div>
              <div className="comparison-table" role="table" aria-label="مقارنة المنشآت">
                {isLiveResult ? (
                  <>
                    <div className="comparison-row head" role="row">
                      <span>المنشأة</span><span>Google</span><span>المرجح</span><span>التقييمات</span><span>المدينة</span>
                    </div>
                    {[placeData, competitorPlaceData].map((place) => (
                      <div className="comparison-row" role="row" key={place.id}>
                        <strong>{place.name}</strong><span>{formatRating(place.rating)}</span><b>{formatRating(assessPlace(place).adjustedRating)}</b><span>{formatCount(place.userRatingCount)}</span><span>{place.city ?? "—"}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="comparison-row head" role="row">
                      <span>المنشأة</span><span>Google</span><span>الموثوق</span><span>الخطر</span><span>الترتيب</span>
                    </div>
                    <div className="comparison-row" role="row">
                      <strong>المكان التجريبي</strong><span>4.90</span><span>{trustedScore}</span><span className="risk-text">76</span><b>02</b>
                    </div>
                    <div className="comparison-row winner" role="row">
                      <strong>المنافس المستقر</strong><span>4.70</span><span>4.66</span><span className="safe-text">14</span><b>01</b>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <p className="result-disclaimer">
            {isLiveResult
              ? "التقييم المرجح وقوة العينة قراءة أولية من المتوسط والحجم. لا تمثل حكمًا على أصالة المراجعات أو اتهامًا للمنشأة."
              : "هذه نتيجة محاكاة لا تصف منشأة حقيقية. استخدم رابطًا فعليًا لاستيراد بيانات Google."}
          </p>
        </section>
      )}

      <section className="how-section" id="كيف-يعمل">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span aria-hidden="true" /> من الرابط إلى قرار أوضح</p>
            <h2>ثلاث خطوات،<br />ولا صندوق أسود.</h2>
          </div>
          <p>
            كل نقطة اشتباه مرتبطة بدليل يمكن عرضه ومراجعته. النموذج اللغوي يلخص الأدلة،
            لكنه لا يصدر القرار العددي.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <div className="step-line" aria-hidden="true"><i /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="method-section" id="المنهجية">
        <div className="method-copy">
          <p className="eyebrow light"><span aria-hidden="true" /> Trust Score v0.2</p>
          <h2>إشارتان مستقلتان قبل الإنذار الأحمر.</h2>
          <p>
            لا يصل التحليل إلى «اشتباه مرتفع» بسبب تقييم واحد، أو نص قصير، أو حساب قليل النشاط.
            نجمع عائلات مختلفة من الأدلة ونُبقي نقص البيانات ظاهرًا.
          </p>
        </div>
        <div className="weights-list">
          {[
            ["شبكة المراجعين والتنسيق", 30],
            ["الاندفاع الزمني والحملات", 20],
            ["تشابه النصوص والصور", 15],
            ["تاريخ وسلوك المراجع", 15],
            ["الجغرافيا وسياق الرحلات", 10],
            ["تطرف النجوم والتناقض", 10],
          ].map(([label, value]) => (
            <div className="weight-row" key={String(label)}>
              <div><span>{label}</span><strong>{value}</strong></div>
              <div className="weight-track"><span style={{ width: `${Number(value) * 3.333}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#الرئيسية">
          <span className="brand-mark" aria-hidden="true">و</span>
          <span><strong>وثوق</strong><small>رؤية أوضح خلف النجوم</small></span>
        </a>
        <p>نسخة تجريبية · نستورد بيانات المكان من Google ونُظهر بوضوح ما لم يُحلل بعد.</p>
        <a href="#الرئيسية">حلّل رابطًا <span aria-hidden="true">↑</span></a>
      </footer>
    </main>
  );
}
