import React, { useState } from "react";
import {
  BookOpen,
  Code2,
  Terminal,
  Settings,
  Layout,
  ArrowRight,
  Check,
  Copy,
  Menu,
  X,
  Globe,
  Zap
} from "lucide-react";
import { cn } from "../lib/utils";
import { trackEvent } from "../lib/analytics";

// --- Components ---

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Track code copy
    trackEvent('docs_code_copied', {
      language,
      code_length: code.length
    });
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border bg-slate-950 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/10">
        <span className="text-xs text-slate-400 font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-slate-50 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  icon: Icon
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ElementType
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-3 mb-6">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon size={24} />
          </div>
        )}
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="prose prose-slate max-w-none text-muted-foreground/90 leading-7">
        {children}
      </div>
    </section>
  );
}

// --- Framework Tabs Component ---

function FrameworkTabs() {
  const [active, setActive] = useState<"react" | "next" | "hugo">("react");

  return (
    <div className="mt-8 border border-border rounded-xl overflow-hidden bg-card/30">
      <div className="flex items-center border-b border-border bg-muted/30">
        {[
          { id: "react", label: "React", icon: Zap },
          { id: "next", label: "Next.js", icon: Terminal },
          { id: "hugo", label: "Hugo", icon: Layout },
        ].map((tab) => {
          const Icon = tab.icon; // Get icon component
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActive(tab.id as any);
                trackEvent('docs_framework_tab_clicked', {
                  framework: tab.id
                });
              }}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-medium border-r border-border transition-all hover:bg-muted/50",
                active === tab.id
                  ? "bg-card text-primary border-b-2 border-b-primary -mb-px"
                  : "text-muted-foreground bg-transparent hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-6 bg-card">
        {active === "react" && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">1. Add the script to <code>public/index.html</code>:</p>
              <CodeBlock code={`<script src="https://commentkit.ankush.one/bundle.js" defer></script>`} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">2. Render the container in your component:</p>
              <CodeBlock language="tsx" code={`export function Comments() {
  return <div data-commentkit />;
}`} />
            </div>
          </div>
        )}

        {active === "next" && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">1. Add script to <code>app/layout.tsx</code>:</p>
              <CodeBlock language="tsx" code={`import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://commentkit.ankush.one/bundle.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}`} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">2. Create a client component:</p>
              <CodeBlock language="tsx" code={`"use client";

export function Comments() {
  return <div data-commentkit />;
}`} />
            </div>
          </div>
        )}

        {active === "hugo" && (
          <div className="animate-in fade-in duration-300">
            <p className="mb-3 text-sm font-medium text-foreground">Add to your partial template (e.g. <code>layouts/partials/comments.html</code>):</p>
            <CodeBlock language="html" code={`{{ if not .Params.disableComments }}
  <section class="comments">
    <div data-commentkit></div>
    <script src="https://commentkit.ankush.one/bundle.js" defer></script>
  </section>
{{ end }}`} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Data ---

const SECTIONS = [
  { id: "introduction", title: "Introduction", icon: BookOpen },
  { id: "installation", title: "Installation", icon: Terminal },
  { id: "frameworks", title: "Frameworks", icon: Layout },
  { id: "api", title: "API Reference", icon: Code2 },
];

export function DocsPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll spy to update active section
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
      setMobileMenuOpen(false);
      // Track section navigation
      trackEvent('docs_section_viewed', {
        section_id: id
      });
    }
  };

  // Track initial page view
  React.useEffect(() => {
    trackEvent('docs_page_viewed', {
      initial_section: 'introduction'
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            CK
          </div>
          CommentKit
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen md:sticky md:top-0 overflow-y-auto",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="hidden md:flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              CK
            </div>
            <span className="font-bold text-xl tracking-tight">CommentKit</span>
          </div>

          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                  activeSection === section.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <section.icon size={18} />
                {section.title}
              </button>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-border">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-4 tracking-wider">Resources</h4>
            <a
              href="https://commentkit.ankush.one"
              className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors mb-3"
            >
              <Globe size={16} /> Website
            </a>
            <a
              href="https://github.com/ankushKun/commentkit"
              className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors mb-3"
            >
              <Zap size={16} /> GitHub
            </a>
            <a
              href="https://commentkit.ankush.one/example"
              target="_blank"
              className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors"
            >
              <ArrowRight size={16} /> Example Demo
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 py-12 md:px-12 md:py-16">

          <header className="mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              v1.0.0 Now Available
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Documentation
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Everything you need to integrate CommentKit's powerful threaded/nested comment system into your website.
            </p>
          </header>

          <div className="space-y-24">

            {/* Introduction */}
            <Section id="introduction" title="Introduction" icon={BookOpen}>
              <p className="mb-4">
                CommentKit is a privacy-focused, lightweight, and embeddable comment system designed for the modern web.
                It provides a seamless commenting experience with features like:
              </p>
              {/* <ul className="grid md:grid-cols-2 gap-4 mt-6 mb-8 text-sm">
                {[
                  "Infinite nested threading (Reddit-style)",
                  "Cross-site authentication with Magic Links",
                  "Markdown support",
                  "Real-time updates",
                  "Responsive design focused on Mobile",
                  "Dark mode support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 bg-card border border-border p-3 rounded-lg">
                    <Check size={16} className="text-primary" />
                    {item}
                  </li>
                ))}
              </ul> */}
              <p>
                Whether you're running a static blog, a documentation site, or a full-fledged web app, CommentKit drops in with just a few lines of code.
              </p>
            </Section>

            {/* Installation */}
            <Section id="installation" title="Installation" icon={Terminal}>
              <p className="mb-6">
                Getting started with CommentKit is incredibly simple. It's designed to be <strong>zero-config</strong>.
              </p>

              <h3 className="text-xl font-semibold text-foreground mb-3 mt-8">1. Add the Script</h3>
              <p className="mb-3">
                Include the CommentKit bundle in your HTML <code>&lt;head&gt;</code> or just before the closing <code>&lt;/body&gt;</code> tag.
              </p>
              <CodeBlock code={`<script src="https://commentkit.ankush.one/bundle.js" defer></script>`} />

              <h3 className="text-xl font-semibold text-foreground mb-3 mt-8">2. Place the Container</h3>
              <p className="mb-3">
                Add the container element where you want the comments to appear.
              </p>
              <CodeBlock code={`<div data-commentkit></div>`} />

              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-lg mt-6 flex items-start gap-3">
                <div className="p-1 bg-blue-500/10 rounded-full text-blue-500 mt-0.5">
                  <Zap size={16} />
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  <strong>Zero Config:</strong> CommentKit automatically identifies the thread using your page URL and title. No extra setup required.
                </div>
              </div>
            </Section>

            {/* Configuration */}
            {/* Frameworks */}
            <Section id="frameworks" title="Framework Integration" icon={Layout}>
              <p className="mb-6">
                CommentKit works with any framework. Select your framework below for specific integration guides.
              </p>
              <FrameworkTabs />
            </Section>

            {/* API Ref */}
            <Section id="api" title="API Reference" icon={Code2}>
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-card/50">
                <div className="p-3 bg-secondary rounded-full mb-4">
                  <Code2 size={32} className="text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
                <p className="text-muted-foreground max-w-sm">
                  We are working on documenting our REST API. Stay tuned for updates!
                </p>
              </div>
            </Section>

          </div>

          <footer className="mt-32 pt-12 border-t border-border text-center text-muted-foreground text-sm">
            <p>&copy; {new Date().getFullYear()} CommentKit. All rights reserved.</p>
          </footer>

        </div>
      </main>
    </div>
  );
}
