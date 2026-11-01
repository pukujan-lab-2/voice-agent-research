import {
  Phone,
  PlayCircle,
  ShieldCheck,
  Ban,
  FileText,
  Lock,
  ArrowRight,
  Stethoscope,
  Wrench,
  Globe,
  MonitorSmartphone,
  Landmark,
  Calculator,
  type LucideIcon,
} from "lucide-react";

const DEMOS: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  name: string;
  blurb: string;
  href: string;
}[] = [
  {
    icon: Stethoscope,
    iconBg: "hsl(174 60% 92%)",
    iconColor: "hsl(174 60% 38%)",
    name: "Tumbleberry Children's Clinic",
    blurb: "Book a paediatric visit in three quick steps.",
    href: "/clinic/book?guest=1",
  },
  {
    icon: Wrench,
    iconBg: "hsl(25 90% 94%)",
    iconColor: "hsl(25 90% 50%)",
    name: "Kettlewisp Appliances",
    blurb: "Request a service visit for a dishwasher fault.",
    href: "/appliance/support?guest=1",
  },
  {
    icon: Globe,
    iconBg: "hsl(75 60% 90%)",
    iconColor: "hsl(75 85% 40%)",
    name: "Larchmoss Studio",
    blurb: "Get a quote for a small web design project.",
    href: "/pricing/quote?guest=1",
  },
  {
    icon: MonitorSmartphone,
    iconBg: "hsl(205 70% 92%)",
    iconColor: "hsl(205 75% 52%)",
    name: "Cobblefin IT Desk",
    blurb: "File an internal IT support ticket.",
    href: "/itdesk/new?guest=1",
  },
  {
    icon: Landmark,
    iconBg: "hsl(142 35% 88%)",
    iconColor: "hsl(142 45% 30%)",
    name: "Saltmere Pension Fund",
    blurb: "Nominate a beneficiary on form R-17.",
    href: "/pension/forms/r17?guest=1",
  },
  {
    icon: Calculator,
    iconBg: "hsl(160 35% 90%)",
    iconColor: "hsl(160 45% 24%)",
    name: "Brindlewick Tax & Accounting",
    blurb: "Ask about a tax return or book a consultation.",
    href: "/tax",
  },
];

const SAFE_POINTS = [
  {
    icon: ShieldCheck,
    title: "Fills only what you confirm",
    text: "The copilot reads back each answer and waits for your yes before it types anything.",
  },
  {
    icon: Ban,
    title: "Never presses Submit",
    text: "The copilot fills the fields. You check the page and press the button yourself.",
  },
  {
    icon: FileText,
    title: "Answers from your documents",
    text: "Quotes your own manual with the page number, or honestly says it doesn't know.",
  },
  {
    icon: Lock,
    title: "Your data stays in house",
    text: "Nothing a visitor types is sent anywhere. Every demo ends on a nothing-was-sent page.",
  },
];

const STEPS = [
  {
    title: "Visitor taps Start voice call",
    text: "A floating bar appears on any form page. One tap and the copilot is listening.",
  },
  {
    title: "Copilot asks, one field at a time",
    text: "It speaks each question in plain words, reads back your answer, and fills the field only after you confirm.",
  },
  {
    title: "Visitor presses Submit",
    text: "The copilot never does. You review the filled form and press the button yourself.",
  },
];

function ConceptVideo() {
  return (
    <div className="mkt-video-wrap">
      <span className="mkt-video-tag">Concept video</span>
      <div
        style={{
          borderRadius: "0.75rem",
          overflow: "hidden",
          border: "1px solid hsl(250 20% 90%)",
          background: "#000",
        }}
      >
        <video
          className="hidden md:block"
          controls
          playsInline
          preload="none"
          poster="/media/copilot-demo-720p.jpg"
          style={{ width: "100%", display: "block" }}
        >
          <source src="/media/copilot-demo-720p.mp4" type="video/mp4" />
        </video>
        <video
          className="block md:hidden"
          controls
          playsInline
          preload="none"
          poster="/media/copilot-demo-vertical-720p.jpg"
          style={{ width: "100%", display: "block", maxHeight: "70vh" }}
        >
          <source src="/media/copilot-demo-vertical-720p.mp4" type="video/mp4" />
        </video>
      </div>
      <p className="mkt-video-caption">
        A scripted concept video: five fictional people on five fictional websites,
        first without and then with a copilot. The live demos below are the real thing.
      </p>
    </div>
  );
}

export default function Index() {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(0 0% 99%)" }}>
      <section className="mkt-hero">
        <div className="mkt-hero-inner">
          <div className="mkt-badge">
            <Phone size={14} /> Website Copilot
          </div>
          <h1>
            A voice assistant that fills in
            <br />
            <span className="accent">your website's forms.</span>
          </h1>
          <p className="sub">
            Visitors tap Start voice call. The copilot asks for each field in plain
            words, types each answer only after confirmation, answers questions from
            your own manual, and never presses Submit.
          </p>
          <div className="mkt-hero-btns">
            <a href="#demos" className="mkt-btn-primary">
              View the live demos <ArrowRight size={18} />
            </a>
            <a href="#video" className="mkt-btn-secondary">
              <PlayCircle size={18} /> Watch the concept video
            </a>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="video">
        <ConceptVideo />
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <h2 className="mkt-section-title">Safe by design</h2>
        <div className="mkt-safe-grid">
          {SAFE_POINTS.map((p, i) => (
            <div key={i} className="mkt-safe-card">
              <div className="icon-wrap">
                <p.icon size={20} />
              </div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="mkt-section"
        style={{
          background: "hsl(252 60% 97%)",
          borderRadius: "1.5rem",
          margin: "2rem auto",
          maxWidth: "1000px",
        }}
      >
        <h2 className="mkt-section-title">How it works</h2>
        <p className="mkt-section-sub">Three steps, from tap to submitted form.</p>
        <div className="mkt-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="mkt-step">
              <div className="mkt-step-num">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section" id="demos">
        <h2 className="mkt-section-title">Try it live</h2>
        <p className="mkt-section-sub">
          Six fictional companies. Each has a real form you can fill by hand or with
          the copilot. Pick one and tap Start voice call.
        </p>
        <div className="mkt-demo-grid">
          {DEMOS.map((d, i) => (
            <div key={i} className="mkt-demo-card">
              <div
                className="demo-icon"
                style={{ background: d.iconBg, color: d.iconColor }}
              >
                <d.icon size={22} />
              </div>
              <h3>{d.name}</h3>
              <p>{d.blurb}</p>
              <a href={d.href} className="demo-link">
                View demo <ArrowRight size={16} />
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="mkt-footer">
        <p>
          Website Copilot, a concept by Design Bakery. The video is a scripted concept;
          the demos are live.
        </p>
        <p style={{ marginTop: "0.5rem", opacity: 0.6 }}>
          Every company, person, product and document on this site is fictional.
          Nothing you type is sent anywhere.
        </p>
      </footer>
    </div>
  );
}
