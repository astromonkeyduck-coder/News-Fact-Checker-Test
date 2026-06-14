"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Panel, PanelTitle } from "@/components/ui/primitives";
import { CopyButton } from "@/components/CopyButton";

/**
 * Capture Helper: generates a SAFE bookmarklet. It only reads the current tab
 * URL + any text the editor has selected, then opens the Add Lead form
 * pre-filled for manual review. It does NOT scrape feeds, automate browsing,
 * bypass logins, download media, or run in the background.
 */
export default function CapturePage() {
  const [origin, setOrigin] = useState("http://localhost:3100");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Bookmarklet: capture href + selection, open Add Lead prefilled.
  const bookmarklet = `javascript:(function(){var u=encodeURIComponent(location.href);var s=encodeURIComponent((window.getSelection?window.getSelection().toString():'').slice(0,500));var h=encodeURIComponent(document.title||'');window.open('${origin}/leads/new?source_url='+u+'&post_text='+s+'&what_it_appears_to_show='+h,'_blank');})();`;

  return (
    <div>
      <PageHeader
        title="Capture helper"
        subtitle="A safe, manual bookmarklet for saving public posts you find yourself."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelTitle>Install the bookmarklet</PanelTitle>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-muted">
              <li>Show your browser&apos;s bookmarks bar.</li>
              <li>
                Create a new bookmark (or drag the link below to the bar). Name it{" "}
                <span className="text-ink">Save to Radar</span>.
              </li>
              <li>Paste the code below as the bookmark&apos;s URL.</li>
              <li>
                On any public post you find manually, select the relevant text, then click the
                bookmark. The Add Lead form opens pre-filled for your review.
              </li>
            </ol>

            <div className="mt-4">
              <a
                href={bookmarklet}
                onClick={(e) => e.preventDefault()}
                className="inline-block rounded border border-border-strong bg-panel-raised px-3 py-1.5 text-sm text-ink"
                draggable
              >
                ▸ Save to Radar
              </a>
              <p className="mt-1 text-2xs text-ink-faint">Drag this to your bookmarks bar.</p>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="label">Bookmarklet code</span>
                <CopyButton text={bookmarklet} />
              </div>
              <textarea
                readOnly
                value={bookmarklet}
                className="field h-28 w-full font-mono text-2xs"
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Or capture by hand</PanelTitle>
            <p className="mt-2 text-sm text-ink-muted">
              You can always open the{" "}
              <a href="/leads/new" className="text-info hover:underline">
                Add Lead
              </a>{" "}
              form directly and paste a URL plus your notes. A signed-in editor session is required.
            </p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="border-warn/40">
            <PanelTitle>What this does NOT do</PanelTitle>
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-ink-muted">
              <li>No scraping of Facebook or any feed.</li>
              <li>No automated browsing or background monitoring.</li>
              <li>No login bypass or platform-restriction evasion.</li>
              <li>No automatic video/media downloads.</li>
              <li>No collection of hidden or private data.</li>
            </ul>
            <p className="mt-3 text-2xs text-ink-faint">
              It only reads the current tab URL and text you have selected, with you in control of
              every save.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
