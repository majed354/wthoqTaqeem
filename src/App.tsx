import { useMemo, useState } from "react";
import type { FormEvent } from "react";

type Mode = "single" | "compare";
type AnalysisState = "idle" | "loading" | "done";

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

export default function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [suspiciousWeight, setSuspiciousWeight] = useState(15);
  const [copied, setCopied] = useState(false);

  const trustedScore = useMemo(() => {
    return (4.39 + suspiciousWeight * 0.003).toFixed(2);
  }, [suspiciousWeight]);

  const canAnalyze = primaryUrl.trim().length > 5;

  function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze) return;

    setAnalysisState("loading");
    window.setTimeout(() => {
      setAnalysisState("done");
      window.setTimeout(() => {
        document.getElementById("النتيجة")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }, 1150);
  }

  function loadExample() {
    setPrimaryUrl("https://maps.app.goo.gl/wothoq-demo-a");
    if (mode === "compare") {
      setCompetitorUrl("https://maps.app.goo.gl/wothoq-demo-b");
    }
  }

  async function copySummary() {
    const summary = `وثوق — تحليل تجريبي\nتقييم قوقل: 4.90/5\nالتقييم الموثوق الحالي: ${trustedScore}/5\nخطر التلاعب: 76/100\nالثقة في التحليل: منخفضة`;
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
          <span className="version-chip">تجريبي · v0.1</span>
        </nav>
      </header>

      <section className="hero" id="الرئيسية">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true" /> مؤشر موثوقية تقييمات قوقل</p>
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
              <strong>تحليل سريع</strong>
            </div>
            <span>بيانات محاكاة</span>
          </div>

          <div className="mode-switch" role="tablist" aria-label="نوع التحليل">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              className={mode === "single" ? "active" : ""}
              onClick={() => setMode("single")}
            >
              منشأة واحدة
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "compare"}
              className={mode === "compare" ? "active" : ""}
              onClick={() => setMode("compare")}
            >
              مقارنة منافسين
            </button>
          </div>

          <label htmlFor="primary-url">رابط المنشأة من قوقل ماب</label>
          <div className="url-field">
            <span className="link-icon" aria-hidden="true">↗</span>
            <input
              id="primary-url"
              type="url"
              inputMode="url"
              placeholder="الصق رابط maps.app.goo.gl"
              value={primaryUrl}
              onChange={(event) => setPrimaryUrl(event.target.value)}
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
                  onChange={(event) => setCompetitorUrl(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!canAnalyze || analysisState === "loading"}>
              {analysisState === "loading" ? "جارٍ فحص الإشارات…" : mode === "compare" ? "حلّل وقارن" : "حلّل الرابط"}
              <span aria-hidden="true">←</span>
            </button>
            <button className="text-button" type="button" onClick={loadExample}>جرّب مثالًا</button>
          </div>

          <p className="form-note">
            النسخة الحالية توضح طريقة الحساب ببيانات تجريبية ولا تجلب مراجعات حقيقية بعد.
          </p>
        </form>
      </section>

      {analysisState === "loading" && (
        <section className="analysis-loader" aria-live="polite" aria-label="جارٍ التحليل">
          <div className="scan-orbit"><span /></div>
          <div>
            <strong>نقرأ ما وراء المتوسط…</strong>
            <p>الزمن ← تشابه النصوص ← شبكات المراجعين ← التصحيح البايزي</p>
          </div>
        </section>
      )}

      {analysisState === "done" && (
        <section className="results-section" id="النتيجة">
          <div className="section-heading result-heading">
            <div>
              <p className="eyebrow light"><span aria-hidden="true" /> نتيجة تجريبية</p>
              <h2>{mode === "compare" ? "المقارنة تكشف الفارق." : "الرقم الخام لا يروي القصة كاملة."}</h2>
            </div>
            <button className="copy-button" type="button" onClick={copySummary}>
              {copied ? "تم النسخ ✓" : "نسخ الملخص"}
            </button>
          </div>

          <div className="report-card">
            <div className="report-identity">
              <div className="place-icon" aria-hidden="true">م</div>
              <div>
                <small>مطعم · الرياض</small>
                <h3>المكان التجريبي</h3>
                <p>تحليل عام من رابط قوقل ماب</p>
              </div>
              <span className="confidence-badge">ثقة منخفضة</span>
            </div>

            <div className="score-grid">
              <article className="score-card raw-score">
                <span>تقييم قوقل الخام</span>
                <div><strong>4.90</strong><small>/ 5</small></div>
                <p>120 تقييمًا ظاهرًا</p>
              </article>
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
            </div>

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
          </div>

          {mode === "compare" && (
            <div className="comparison-card">
              <div className="comparison-intro">
                <span>الترتيب بعد التصحيح</span>
                <h3>الاستقرار يتفوق على الرقم الأعلى.</h3>
                <p>نرتب بالحد الأدنى لنطاق الثقة، لا بالمتوسط الخام وحده.</p>
              </div>
              <div className="comparison-table" role="table" aria-label="مقارنة المنشآت">
                <div className="comparison-row head" role="row">
                  <span>المنشأة</span><span>قوقل</span><span>الموثوق</span><span>الخطر</span><span>الترتيب</span>
                </div>
                <div className="comparison-row" role="row">
                  <strong>المكان التجريبي</strong><span>4.90</span><span>{trustedScore}</span><span className="risk-text">76</span><b>02</b>
                </div>
                <div className="comparison-row winner" role="row">
                  <strong>المنافس المستقر</strong><span>4.70</span><span>4.66</span><span className="safe-text">14</span><b>01</b>
                </div>
              </div>
            </div>
          )}

          <p className="result-disclaimer">
            هذه نتيجة محاكاة لا تصف منشأة حقيقية. عند ربط البيانات الرسمية ستظهر التغطية ومصدر كل دليل بوضوح.
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
          <p className="eyebrow light"><span aria-hidden="true" /> Trust Score v0.1</p>
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
        <p>نموذج أولي · البيانات المعروضة محاكاة وليست حكمًا على منشأة حقيقية.</p>
        <a href="#الرئيسية">حلّل رابطًا <span aria-hidden="true">↑</span></a>
      </footer>
    </main>
  );
}
