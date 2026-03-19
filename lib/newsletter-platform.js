const fs = require("fs");
const path = require("path");
const { parseGithubRepoConfig, pushFileToGithub } = require("./github-push");

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return fallback;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return safeJsonParse(fs.readFileSync(filePath, "utf8"), fallback);
  } catch (_e) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mapMonthName(month) {
  const m = String(month || "").trim().toLowerCase();
  const index = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ].indexOf(m);
  return index >= 0 ? index + 1 : null;
}

function canManageNewsletter(user) {
  if (!user) return false;
  const role = String(user.role_title || "").trim().toLowerCase();
  const isPresident = user.permission_level === "president" || user.view_type === "president";
  const isInternalVp =
    (user.permission_level === "vp" || user.view_type === "vp") &&
    String(user.vp_type || "").toLowerCase() === "internal";
  const isOpsDirector = role === "director of operations";
  return isPresident || isInternalVp || isOpsDirector;
}

function extractPdfTextFromBuffer(buffer) {
  // Lightweight heuristic extraction without adding heavy PDF deps.
  const latin = Buffer.from(buffer).toString("latin1");
  const chunks = latin.match(/[A-Za-z0-9][A-Za-z0-9,.;:()'"!?/\-\s]{20,}/g) || [];
  const lines = chunks
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 30);
  return lines.slice(0, 220).join("\n");
}

function extractFirstHtmlDocument(rawText) {
  const s = String(rawText || "");
  const lower = s.toLowerCase();
  const start = lower.indexOf("<html");
  const end = lower.lastIndexOf("</html>");
  if (start >= 0 && end >= 0 && end > start) return s.slice(start, end + "</html>".length);
  return s.trim();
}

function normalizeStoryInput(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch (_e) {
    return null;
  }
}

function validateGeneratedNewsletterHtml(html) {
  const text = String(html || "").trim();
  if (!text) return { ok: false, error: "Model returned empty HTML." };

  const has = (re) => {
    try {
      return re.test(text);
    } catch (_e) {
      return false;
    }
  };

  if (!has(/<html[^>]*>/i)) return { ok: false, error: "missing <html>" };
  if (!has(/<style[^>]*>/i)) return { ok: false, error: "missing <style> block" };
  if (!has(/masthead/i)) return { ok: false, error: "missing masthead section" };
  if (!has(/hero-band/i)) return { ok: false, error: "missing hero band section" };

  const hasWideWrapper = has(/story-wide/i);
  const hasWideInner = has(/story-wide-images/i) && has(/story-wide-content/i);
  if (!hasWideWrapper && !hasWideInner) return { ok: false, error: "missing wide story section" };

  if (!has(/newsletter-footer/i)) return { ok: false, error: "missing newsletter footer section" };
  if (!has(/logo-v3\.png/i)) return { ok: false, error: "missing logo-v3.png reference" };
  if (!has(/fonts\.googleapis\.com/i)) return { ok: false, error: "missing Google Fonts link" };
  if (!has(/\bnewsletter\b/i)) return { ok: false, error: "missing newsletter wrapper" };

  // Basic order sanity: footer appears after wide story if we can find it.
  const footerIdx = text.search(/newsletter-footer/i);
  const wideIdx = text.search(/story-wide/i) >= 0 ? text.search(/story-wide/i) : text.search(/story-wide-images/i);
  if (footerIdx > 0 && wideIdx > 0 && footerIdx < wideIdx) {
    return { ok: false, error: "newsletter-footer appears before wide story" };
  }

  return { ok: true };
}

function buildDraftPrompt(designContract, payload) {
  const pdfExtracts = Array.isArray(payload.pdf_sources) && payload.pdf_sources.length
    ? payload.pdf_sources
        .map(
          (p, idx) =>
            `PDF_EXTRACT_${idx + 1}_FILENAME: ${String(p.filename || "").trim()}\nPDF_EXTRACT_${idx + 1}_TEXT:\n${String(p.summary || "").slice(0, 9000)}`
        )
        .join("\n\n")
    : "PDF_EXTRACTS: (none provided)";

  const imageFilenames = Array.isArray(payload.image_filenames) ? payload.image_filenames : [];

  const imageListText = imageFilenames.length ? imageFilenames.join(", ") : "about-ssa.JPG";

  return `
${designContract}

Return exactly one complete HTML file and nothing else.

INPUT CONTENT (from admin):
EDITION_NAME: ${String(payload.edition_name || "").trim()}
MONTH: ${String(payload.month || "").trim()}
YEAR: ${String(payload.year || "").trim()}
DATE_RANGE: ${String(payload.date_range || "").trim()}
HERO_LINE_1: ${String(payload.hero_line_1 || "").trim()}
HERO_LINE_2: ${String(payload.hero_line_2 || "").trim()}
HERO_SUBTITLE: ${String(payload.hero_subtitle || "").trim()}
CLOSING_PHRASE: ${String(payload.closing_phrase || "").trim()}

UPLOADED IMAGE FILENAMES (use filenames only in output HTML):
${imageListText}

${pdfExtracts}

NOTES (optional, admin field):
${String(payload.notes || "").trim()}

Story generation rules (important):
- You do NOT have pre-filled STORY_1/2/3 objects; you must create the full masthead, hero band, Story 1, Story 2, and Story 3 content yourself from the PDF extracts + metadata.
- If you only have one uploaded image filename, reuse it for both Story 3 images (S3_IMAGE_1 and S3_IMAGE_2).

Strict output rules:
- Output only one complete HTML document.
- Do not include markdown code fences.
- Do not include explanations.
- Keep all CSS inside a single <style> block.
- Keep required class names and section order exactly as specified.
- Reference images by filename only.

Image fallback requirement:
- If the input has no uploaded image files (image_filenames is empty), use \`about-ssa.JPG\` as the story image(s).
- The logo must always use \`logo-v3.png\` (and never be replaced by other imagery).
- Use at most 4 story images total in the newsletter.

Wide story contract requirement:
- The output MUST include the exact tokens: \`story-wide\`, \`story-wide-images\`, and \`story-wide-content\`.
- The wide story MUST appear before \`newsletter-footer\`.

CRITICAL: You MUST output the COMPLETE HTML document from <!DOCTYPE or <html through the closing </html>. Do not truncate or stop early. Include every section: masthead, hero-band, all three stories, story-wide (with story-wide-images and story-wide-content), and newsletter-footer.
`;
}

async function attemptRepairNewsletterHtml(geminiApiKey, designContract, previousHtml, payload, validationError) {
  const maxPrev = 12000;
  const prev = String(previousHtml || "");
  const clipped = prev.length > maxPrev ? prev.slice(0, maxPrev) + "\n<!-- CLIPPED -->\n" + prev.slice(-maxPrev) : prev;

  const pdfExtracts = Array.isArray(payload.pdf_sources) && payload.pdf_sources.length
    ? payload.pdf_sources
        .map((p, idx) => `PDF_EXTRACT_${idx + 1}_FILENAME: ${String(p.filename || "").trim()}\nPDF_EXTRACT_${idx + 1}_TEXT:\n${String(p.summary || "").slice(0, 6000)}`)
        .join("\n\n")
    : "";

  const imageFilenames = Array.isArray(payload.image_filenames) ? payload.image_filenames : [];
  const imageListText = imageFilenames.length ? imageFilenames.join(", ") : "about-ssa.JPG";

  const prompt = `
${designContract}

You must REPAIR the following HTML so it STRICTLY matches the SSA newsletter design contract.

Validation error you must fix:
${String(validationError || "")}

REQUIREMENTS:
- Output exactly one complete HTML file and nothing else.
- Keep all CSS in a single <style> block.
- The HTML must include the following tokens/sections (case-sensitive tokens are shown, but you can rely on class names):
  - masthead
  - hero-band
  - story
  - story-wide
  - story-wide-images
  - story-wide-content
  - newsletter-footer
- Ensure hero/title structure matches contract.
- Ensure images reference filenames only (use about-ssa.JPG if none were uploaded).
- Output the COMPLETE document through closing </html>. Do not truncate.

ADMIN INPUT (for content accuracy):
EDITION_NAME: ${String(payload.edition_name || "").trim()}
MONTH: ${String(payload.month || "").trim()}
YEAR: ${String(payload.year || "").trim()}
DATE_RANGE: ${String(payload.date_range || "").trim()}
HERO_LINE_1: ${String(payload.hero_line_1 || "").trim()}
HERO_LINE_2: ${String(payload.hero_line_2 || "").trim()}
HERO_SUBTITLE: ${String(payload.hero_subtitle || "").trim()}
CLOSING_PHRASE: ${String(payload.closing_phrase || "").trim()}

UPLOADED IMAGE FILENAMES:
${imageListText}

PDF EXTRACTS:
${pdfExtracts}

PREVIOUS HTML (repair this):
${clipped}
`;

  return callGeminiForNewsletter(geminiApiKey, prompt);
}

function buildFallbackHtml(payload) {
  const nowYear = Number(payload.year) || new Date().getFullYear();
  const placeholderImg = payload.placeholder_image || "about-ssa.JPG";
  const stories = Array.isArray(payload.stories) && payload.stories.length
    ? payload.stories
    : [
        {
          section_label: "Event Recap",
          date: payload.date_range || "This Month",
          heading: "SSA Community Highlights",
          body: payload.notes || "Updates from this month are being prepared.",
          highlight: "We appreciate every member who contributed to this month's programming.",
          collab_tags: [],
          image_file: payload.image_filenames?.[0] || placeholderImg,
          image_caption: "SSA Community"
        },
        {
          section_label: "Community Presence",
          date: payload.date_range || "This Month",
          heading: "Student Leadership in Action",
          body: payload.notes || "SSA leadership continued planning and execution across divisions.",
          highlight: "Our board remains committed to strong execution and meaningful impact.",
          collab_tags: [],
          image_file: payload.image_filenames?.[1] || payload.image_filenames?.[0] || placeholderImg,
          image_caption: "SSA Leadership"
        },
        {
          section_label: "Signature Story",
          date: payload.date_range || "This Month",
          heading: "Building Momentum Together",
          body: payload.notes || "More highlights and stories are coming soon.",
          highlight: "The SSA community continues to grow through collaboration and shared purpose.",
          collab_tags: [],
          image_file_1: payload.image_filenames?.[2] || payload.image_filenames?.[0] || placeholderImg,
          image_file_2: payload.image_filenames?.[3] || payload.image_filenames?.[1] || placeholderImg
        }
      ];

  const s1 = stories[0];
  const s2 = stories[1] || s1;
  const s3 = stories[2] || s2;
  const tags = (arr) =>
    Array.isArray(arr) && arr.length
      ? arr.map((t) => `<span class="collab-tag">${escapeHtml(t)}</span>`).join("")
      : '<div class="gold-rule"></div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>SSA Newsletter - ${escapeHtml(payload.edition_name || "Monthly Edition")}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
:root { --navy:#0b0f1c; --navy-mid:#141929; --navy-light:#1e2540; --white:#f8f6f2; --off-white:#ede9e1; --silver:#9a9fad; --gold:#b89a5c; --gold-light:#d4b87a; --stone:#c4bdb0; }
*{box-sizing:border-box} body{margin:0;background:var(--navy);color:var(--white);font-family:'DM Sans',sans-serif;padding:24px}
.newsletter{width:900px;max-width:100%;margin:0 auto;background:var(--navy)}
.masthead{background:var(--navy-mid);border-bottom:1px solid rgba(184,154,92,.18);padding:36px 60px 30px;display:flex;justify-content:space-between}
.masthead-logo{display:flex;gap:12px;align-items:center}.masthead-logo img{width:38px;height:38px}.masthead-logo-title{font-family:'Cormorant Garamond',serif;font-size:15px;letter-spacing:.2em;text-transform:uppercase}
.masthead-logo-sub{display:block;color:var(--silver);font-size:8px;letter-spacing:.2em;text-transform:uppercase}
.masthead-right{text-align:right}.masthead-issue{font-size:9px;letter-spacing:.3em;color:var(--gold);text-transform:uppercase}.masthead-date{font-family:'Cormorant Garamond',serif;font-size:18px;color:var(--stone)}
.hero-band{background:var(--navy-light);border-top:1px solid rgba(184,154,92,.1);border-bottom:3px solid var(--gold);padding:48px 60px 40px;text-align:center}
.hero-eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}.hero-title{font-family:'Cormorant Garamond',serif;font-size:64px;font-weight:300;line-height:1.08;margin:18px 0}.hero-title em{color:var(--stone)}
.hero-subtitle{font-size:13px;color:var(--silver);letter-spacing:.12em;text-transform:uppercase}.hero-crescent{font-size:28px;color:var(--gold);opacity:.7;letter-spacing:.3em;margin-top:14px}
.story{padding:56px 60px;border-bottom:1px solid rgba(255,255,255,.06)} .story:nth-of-type(even){background:var(--navy-mid)}
.story-inner{display:grid;gap:36px;align-items:start}.img-left{grid-template-columns:320px 1fr}.img-right{grid-template-columns:1fr 320px}
.story-image img{width:100%;height:240px;object-fit:cover;object-position:center 20%;filter:brightness(.92) contrast(1.05)}
.story-image-caption{font-size:9px;color:var(--stone);letter-spacing:.14em;text-transform:uppercase;margin-top:8px}
.section-label{font-size:8px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold)}.story-date-tag{display:inline-block;background:var(--gold);color:var(--navy);padding:5px 14px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin:12px 0}
.story-heading{font-family:'Cormorant Garamond',serif;font-size:26px;line-height:1.2;margin-bottom:10px}.story-body{font-size:14px;color:var(--silver);line-height:1.85}
.story-highlight{border-left:2px solid var(--gold);background:rgba(184,154,92,.06);padding:10px 12px;margin-top:12px;font-size:13px;color:var(--stone);line-height:1.7}
.collab-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.collab-tag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;border:1px solid rgba(184,154,92,.25);color:var(--stone)}
.gold-rule{width:60px;height:1px;background:var(--gold);margin-top:14px}
.story-wide{padding:56px 60px;border-bottom:1px solid rgba(255,255,255,.06)} .story-wide-images{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:28px}
.story-wide-images img{width:100%;height:220px;object-fit:cover;filter:brightness(.9) contrast(1.05)} .story-wide-content{max-width:680px}
.newsletter-footer{background:var(--navy-mid);border-top:1px solid rgba(184,154,92,.15);padding:28px 60px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.footer-left{display:flex;gap:8px;align-items:center}.footer-left img{height:22px;opacity:.65}.footer-left span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--silver)}
.footer-center{font-size:10px;color:rgba(154,159,173,.45)}.footer-right{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
</style>
</head>
<body>
<div class="newsletter">
  <div class="masthead">
    <div class="masthead-logo"><img src="logo-v3.png" alt="SSA"/><div><span class="masthead-logo-title">SSA</span><span class="masthead-logo-sub">University of Minnesota</span></div></div>
    <div class="masthead-right"><div class="masthead-issue">${escapeHtml(payload.edition_name || "Monthly Edition")} - ${escapeHtml(nowYear)}</div><div class="masthead-date">${escapeHtml(payload.date_range || "")}</div></div>
  </div>
  <div class="hero-band">
    <div class="hero-eyebrow">Community Newsletter</div>
    <div class="hero-title">${escapeHtml(payload.hero_line_1 || "SSA")}<br/><em>${escapeHtml(payload.hero_line_2 || "Community")}</em></div>
    <div class="hero-subtitle">${escapeHtml(payload.hero_subtitle || "Events - Community - Reflection")}</div>
    <div class="hero-crescent">? ? ?</div>
  </div>
  <div class="story"><div class="story-inner img-left"><div class="story-image"><img src="${escapeHtml(s1.image_file || placeholderImg)}" alt="${escapeHtml(s1.heading || "")}"/><div class="story-image-caption">${escapeHtml(s1.image_caption || "")}</div></div><div class="story-content"><div class="section-label">${escapeHtml(s1.section_label || "")}</div><div class="story-date-tag">${escapeHtml(s1.date || "")}</div><div class="story-heading">${escapeHtml(s1.heading || "")}</div><div class="story-body">${escapeHtml(s1.body || "")}</div><div class="story-highlight">${String(s1.highlight || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div><div class="collab-row">${tags(s1.collab_tags)}</div></div></div></div>
  <div class="story"><div class="story-inner img-right"><div class="story-content"><div class="section-label">${escapeHtml(s2.section_label || "")}</div><div class="story-date-tag">${escapeHtml(s2.date || "")}</div><div class="story-heading">${escapeHtml(s2.heading || "")}</div><div class="story-body">${escapeHtml(s2.body || "")}</div><div class="story-highlight">${String(s2.highlight || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>${Array.isArray(s2.collab_tags) && s2.collab_tags.length ? `<div class="collab-row">${tags(s2.collab_tags)}</div>` : '<div class="gold-rule"></div>'}</div><div class="story-image"><img src="${escapeHtml(s2.image_file || placeholderImg)}" alt="${escapeHtml(s2.heading || "")}"/><div class="story-image-caption">${escapeHtml(s2.image_caption || "")}</div></div></div></div>
  <div class="story-wide"><div class="story-wide-images"><img src="${escapeHtml(s3.image_file_1 || placeholderImg)}" alt="${escapeHtml(s3.heading || "")}"/><img src="${escapeHtml(s3.image_file_2 || placeholderImg)}" alt="${escapeHtml(s3.heading || "")}"/></div><div class="story-wide-content"><div class="section-label">${escapeHtml(s3.section_label || "")}</div><div class="story-date-tag">${escapeHtml(s3.date || "")}</div><div class="story-heading">${escapeHtml(s3.heading || "")}</div><div class="story-body">${escapeHtml(s3.body || "")}</div><div class="story-highlight">${String(s3.highlight || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div><div class="collab-row">${tags(s3.collab_tags)}</div></div></div>
  <div class="newsletter-footer"><div class="footer-left"><img src="logo-v3.png" alt="SSA"/><span>Somali Student Association - UMN</span></div><div class="footer-center">© ${escapeHtml(nowYear)} SSA Newsletter - University of Minnesota, Twin Cities</div><div class="footer-right">${escapeHtml(payload.closing_phrase || "SSA Community")}</div></div>
</div>
</body>
</html>`;
}

function copyLogoIntoNewsletterRoot(rootDir, newsletterRootDir) {
  const logoSource = path.join(rootDir, "logo-images", "logo-v3.png");
  const logoTarget = path.join(newsletterRootDir, "logo-v3.png");
  if (fs.existsSync(logoSource) && !fs.existsSync(logoTarget)) {
    fs.copyFileSync(logoSource, logoTarget);
  }
}

function getNewsletterStorage(rootDir) {
  const dataDir = path.join(rootDir, "data");
  const newsletterRootDir = path.join(rootDir, "newsletters");
  const editionsDir = path.join(newsletterRootDir, "editions");
  const archivePath = path.join(dataDir, "newsletters.json");
  const currentPath = path.join(dataDir, "current-newsletter.json");
  const currentHtmlPath = path.join(newsletterRootDir, "current.html");
  const legacyPath = path.join(rootDir, "data", "newsletter.json");
  const designDocPath = path.join(dataDir, "newsletter-design-contract.md");
  return {
    dataDir,
    newsletterRootDir,
    editionsDir,
    archivePath,
    currentPath,
    currentHtmlPath,
    legacyPath,
    designDocPath
  };
}

function ensureNewsletterStorage(rootDir) {
  const storage = getNewsletterStorage(rootDir);
  ensureDir(storage.dataDir);
  ensureDir(storage.newsletterRootDir);
  ensureDir(storage.editionsDir);
  copyLogoIntoNewsletterRoot(rootDir, storage.newsletterRootDir);
  // Placeholder image for when newsletter assets are missing.
  const placeholderSrc = path.join(rootDir, "about-ssa-images", "about-ssa.JPG");
  const placeholderTarget = path.join(storage.newsletterRootDir, "about-ssa.JPG");
  if (fs.existsSync(placeholderSrc) && !fs.existsSync(placeholderTarget)) {
    fs.copyFileSync(placeholderSrc, placeholderTarget);
  }
  const logoSourceInRoot = path.join(storage.newsletterRootDir, "logo-v3.png");
  const logoTargetInEditions = path.join(storage.editionsDir, "logo-v3.png");
  if (fs.existsSync(logoSourceInRoot) && !fs.existsSync(logoTargetInEditions)) {
    fs.copyFileSync(logoSourceInRoot, logoTargetInEditions);
  }
  const placeholderInEditions = path.join(storage.editionsDir, "about-ssa.JPG");
  if (fs.existsSync(placeholderTarget) && !fs.existsSync(placeholderInEditions)) {
    fs.copyFileSync(placeholderTarget, placeholderInEditions);
  }

  const archive = readJson(storage.archivePath, []);
  const current = readJson(storage.currentPath, null);
  if (archive.length && current && fs.existsSync(storage.currentHtmlPath)) return;

  const legacy = readJson(storage.legacyPath, []);
  const first = Array.isArray(legacy) && legacy.length ? legacy[0] : {};
  const now = new Date();
  const title = String(first.title || "SSA Newsletter").trim();
  const dateStr = String(first.date || `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`).trim();
  const [rawMonth, rawYear] = dateStr.split(" ");
  const month = rawMonth || now.toLocaleString("default", { month: "long" });
  const year = Number(rawYear) || now.getFullYear();
  const editionName = title || `${month} Edition`;
  const slugBase = slugify(`${month}-${year}`) || `newsletter-${Date.now()}`;
  const html = buildFallbackHtml({
    edition_name: editionName,
    month,
    year,
    date_range: dateStr,
    hero_line_1: month,
    hero_line_2: "Community",
    hero_subtitle: "Events · Community · Reflection",
    closing_phrase: "Somali Student Association",
    notes: first.description || "",
    image_filenames: first.image ? [path.basename(String(first.image))] : [],
    placeholder_image: "about-ssa.JPG"
  });

  fs.writeFileSync(storage.currentHtmlPath, html, "utf8");
  const editionHtmlPath = path.join(storage.editionsDir, `${slugBase}.html`);
  fs.writeFileSync(editionHtmlPath, html, "utf8");

  // Archived edition HTML must reference assets in the same folder (filename-only paths).
  const copyIntoEditionsDir = (filename) => {
    const src = path.join(storage.newsletterRootDir, filename);
    const dest = path.join(storage.editionsDir, filename);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  };
  copyIntoEditionsDir("logo-v3.png");
  copyIntoEditionsDir("about-ssa.JPG");
  if (first.image) copyIntoEditionsDir(path.basename(String(first.image)));

  const record = {
    id: slugBase,
    slug: slugBase,
    edition_name: editionName,
    month,
    year,
    date_range: dateStr,
    hero_line_1: month,
    hero_line_2: "Community",
    hero_subtitle: "Events · Community · Reflection",
    closing_phrase: "Somali Student Association",
    html_path: `newsletters/editions/${slugBase}.html`,
    status: "current",
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    image_references: first.image ? [path.basename(String(first.image))] : [],
    source_pdfs: [],
    source_summary: first.description || ""
  };

  writeJson(storage.archivePath, [record]);
  writeJson(storage.currentPath, {
    current_id: record.id,
    current_html_path: "newsletters/current.html",
    updated_at: new Date().toISOString()
  });
}

// parseGithubRepoConfig and pushFileToGithub imported from github-push.js

function getCurrentNewsletterState(storage) {
  const archive = readJson(storage.archivePath, []);
  const current = readJson(storage.currentPath, {});
  const currentId = String(current.current_id || "");
  const currentRecord = archive.find((x) => String(x.id) === currentId) || archive.find((x) => x.status === "current") || null;
  const currentHtmlAbs = storage.currentHtmlPath;
  const currentHtml = fs.existsSync(currentHtmlAbs) ? fs.readFileSync(currentHtmlAbs, "utf8") : "";
  return {
    current: currentRecord,
    current_html: currentHtml,
    current_html_path: "newsletters/current.html"
  };
}

function validateEditPayload(body) {
  const editionName = String(body.edition_name || "").trim();
  const month = String(body.month || "").trim();
  const year = Number(body.year || 0);
  const dateRange = String(body.date_range || "").trim();
  const heroLine1 = String(body.hero_line_1 || "").trim();
  const heroLine2 = String(body.hero_line_2 || "").trim();
  const heroSubtitle = String(body.hero_subtitle || "").trim();
  const closingPhrase = String(body.closing_phrase || "").trim();
  return {
    edition_name: editionName,
    month,
    year: Number.isFinite(year) && year > 0 ? year : new Date().getFullYear(),
    date_range: dateRange,
    hero_line_1: heroLine1,
    hero_line_2: heroLine2,
    hero_subtitle: heroSubtitle,
    closing_phrase: closingPhrase
  };
}

function extractImageFilenamesFromHtml(html) {
  const out = [];
  const rx = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = rx.exec(String(html || "")))) {
    const src = String(match[1] || "").trim();
    if (!src || src.startsWith("http")) continue;
    out.push(path.basename(src));
  }
  return [...new Set(out)];
}

async function callGeminiForNewsletter(geminiApiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini generation failed: ${String(errText).slice(0, 500)}`);
  }

  const json = await response.json();
  const candidate = (json?.candidates || [])[0];
  const rawText = (candidate?.content?.parts || [])
    .map((p) => p?.text || "")
    .join("\n")
    .trim();

  const stripped = rawText
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let html = extractFirstHtmlDocument(stripped);

  // If response was truncated (no </html> or finishReason is MAX_TOKENS), ask Gemini to complete the document once.
  const finishReason = candidate?.finishReason || "";
  const isTruncated =
    finishReason === "MAX_TOKENS" ||
    (html && !/<\/html\s*>/i.test(html));

  if (isTruncated && html && html.length > 200) {
    const completionPrompt = `The following newsletter HTML was cut off. Complete it so the document is full: include any missing story sections, story-wide, newsletter-footer, and end with </body></html>. Output ONLY the complete HTML document from <!DOCTYPE or <html through </html>. Do not repeat the beginning; if you must output the full document to fix it, do so.

Incomplete HTML:
${html.slice(-14000)}
`;
    try {
      const completed = await callGeminiForNewsletterRaw(geminiApiKey, completionPrompt);
      const completedHtml = extractFirstHtmlDocument(
        completed.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
      );
      if (completedHtml && /<\/html\s*>/i.test(completedHtml)) html = completedHtml;
    } catch (_e) {
      // Keep original html if completion fails
    }
  }

  return html;
}

async function callGeminiForNewsletterRaw(geminiApiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini completion failed: ${String(errText).slice(0, 300)}`);
  }
  const json = await response.json();
  return (json?.candidates || [])
    .flatMap((c) => c?.content?.parts || [])
    .map((p) => p?.text || "")
    .join("\n")
    .trim();
}

function deleteUnusedNewsletterAssets(currentHtmlPath, newsletterRootDir, newsletterImagesDir) {
  if (!fs.existsSync(currentHtmlPath)) return;
  const html = fs.readFileSync(currentHtmlPath, "utf8");
  const refs = new Set(extractImageFilenamesFromHtml(html).map((f) => f.toLowerCase()));
  refs.add("current.html");
  if (newsletterRootDir && fs.existsSync(newsletterRootDir)) {
    const names = fs.readdirSync(newsletterRootDir);
    for (const name of names) {
      const full = path.join(newsletterRootDir, name);
      if (fs.statSync(full).isDirectory()) continue;
      if (!refs.has(name.toLowerCase())) {
        try {
          fs.unlinkSync(full);
        } catch (_e) {}
      }
    }
  }
  if (newsletterImagesDir && fs.existsSync(newsletterImagesDir)) {
    const names = fs.readdirSync(newsletterImagesDir);
    for (const name of names) {
      if (!refs.has(name.toLowerCase())) {
        try {
          fs.unlinkSync(path.join(newsletterImagesDir, name));
        } catch (_e) {}
      }
    }
  }
}

function setupNewsletterPlatform({ app, rootDir, upload, getUserFromSession, geminiApiKey, newsletterImagesDir }) {
  const storage = getNewsletterStorage(rootDir);
  ensureNewsletterStorage(rootDir);

  app.get("/api/public/newsletter/current", (_req, res) => {
    const state = getCurrentNewsletterState(storage);
    res.json({
      current: state.current,
      current_html_path: state.current_html_path
    });
  });

  app.get("/api/newsletter/admin/state", (req, res) => {
    const user = getUserFromSession(req.header("x-session-token"));
    if (!user) return res.status(401).json({ error: "Invalid session." });
    if (!canManageNewsletter(user)) return res.status(403).json({ error: "You do not have newsletter permissions." });
    const state = getCurrentNewsletterState(storage);
    return res.json({
      can_manage: true,
      current: state.current,
      current_html: state.current_html,
      current_html_path: state.current_html_path
    });
  });

  app.put("/api/newsletter/current", (req, res) => {
    const user = getUserFromSession(req.header("x-session-token"));
    if (!user) return res.status(401).json({ error: "Invalid session." });
    if (!canManageNewsletter(user)) return res.status(403).json({ error: "You do not have newsletter permissions." });

    const body = req.body || {};
    const metadata = validateEditPayload(body);
    const html = String(body.html_content || "").trim();
    if (!html) return res.status(400).json({ error: "html_content is required." });
    const htmlValidation = validateGeneratedNewsletterHtml(html);
    if (!htmlValidation.ok) return res.status(400).json({ error: htmlValidation.error });

    const currentState = getCurrentNewsletterState(storage);
    const archive = readJson(storage.archivePath, []);
    const currentId = currentState.current?.id || slugify(`${metadata.month}-${metadata.year}`) || `newsletter-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const imageRefs = extractImageFilenamesFromHtml(html);
    const nextRecord = {
      ...(currentState.current || {}),
      id: currentId,
      slug: currentState.current?.slug || slugify(`${metadata.month}-${metadata.year}`) || currentId,
      edition_name: metadata.edition_name || currentState.current?.edition_name || "SSA Newsletter",
      month: metadata.month || currentState.current?.month || "",
      year: metadata.year || currentState.current?.year || new Date().getFullYear(),
      date_range: metadata.date_range || currentState.current?.date_range || "",
      hero_line_1: metadata.hero_line_1 || currentState.current?.hero_line_1 || "",
      hero_line_2: metadata.hero_line_2 || currentState.current?.hero_line_2 || "",
      hero_subtitle: metadata.hero_subtitle || currentState.current?.hero_subtitle || "",
      closing_phrase: metadata.closing_phrase || currentState.current?.closing_phrase || "",
      html_path: currentState.current?.html_path || "newsletters/current.html",
      status: "current",
      updated_by: user.email,
      updated_at: nowIso,
      published_at: currentState.current?.published_at || nowIso,
      image_references: imageRefs
    };
    const idx = archive.findIndex((x) => String(x.id) === String(currentId));
    if (idx >= 0) archive[idx] = nextRecord;
    else archive.unshift(nextRecord);
    writeJson(storage.archivePath, archive);
    writeJson(storage.currentPath, {
      current_id: nextRecord.id,
      current_html_path: "newsletters/current.html",
      updated_at: nowIso
    });
    fs.writeFileSync(storage.currentHtmlPath, html, "utf8");
    if (newsletterImagesDir) deleteUnusedNewsletterAssets(storage.currentHtmlPath, storage.newsletterRootDir, newsletterImagesDir);

    const pushRequested = body.push_to_github !== false;
    if (pushRequested) {
      const cfg = parseGithubRepoConfig();
      if (!cfg) return res.status(400).json({ error: "GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH are not fully configured." });
      (async () => {
        try {
          await pushFileToGithub(cfg, "data/newsletters.json", storage.archivePath, "Update SSA newsletter archive");
          await pushFileToGithub(cfg, "data/current-newsletter.json", storage.currentPath, "Update SSA current newsletter pointer");
          await pushFileToGithub(cfg, "newsletters/current.html", storage.currentHtmlPath, "Update current SSA newsletter page");
          res.json({ ok: true, pushed: true });
        } catch (e) {
          res.status(502).json({ error: String(e.message || "GitHub publish failed.") });
        }
      })();
      return;
    }

    return res.json({ ok: true, pushed: false });
  });

  app.post("/api/newsletter/generate-draft", upload.array("assets", 30), async (req, res) => {
    const user = getUserFromSession(req.header("x-session-token"));
    if (!user) return res.status(401).json({ error: "Invalid session." });
    if (!canManageNewsletter(user)) return res.status(403).json({ error: "You do not have newsletter permissions." });

    const body = req.body || {};
    const metadata = validateEditPayload(body);
    const stories = normalizeStoryInput(body.stories_json) || [];
    const notes = String(body.notes || "").trim();
    const sourceText = String(body.source_text || body.sourceText || body.source || "").trim();

    if (!fs.existsSync(storage.designDocPath)) {
      return res.status(500).json({
        error: "Newsletter design contract is missing on server.",
        can_retry: false
      });
    }
    const designContract = fs.readFileSync(storage.designDocPath, "utf8");

    const files = Array.isArray(req.files) ? req.files : [];
    ensureDir(storage.newsletterRootDir);
    const pdfSummaries = [];
    // Generation should be text-first. Images can be uploaded for later use,
    // but Gemini generation will use the placeholder fallback if no image filenames are provided.
    const imageFilenames = [];
    const savedAssets = [];

    for (const file of files) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const base = slugify(path.basename(file.originalname || "asset", ext)) || `asset-${Date.now()}`;
      const safeExt = ext || ".bin";
      const filename = `${base}-${Date.now()}${safeExt}`;
      const destAbs = path.join(storage.newsletterRootDir, filename);
      fs.copyFileSync(file.path, destAbs);
      savedAssets.push(`newsletters/${filename}`);
      if (String(file.mimetype || "").includes("pdf") || safeExt === ".pdf") {
        try {
          const pdfText = extractPdfTextFromBuffer(fs.readFileSync(file.path));
          pdfSummaries.push({ filename, summary: pdfText.slice(0, 6000) });
        } catch (_e) {
          pdfSummaries.push({ filename, summary: "" });
        }
      } else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(safeExt)) {
        if (imageFilenames.length < 4) imageFilenames.push(filename);
      }
    }

    if (sourceText) {
      pdfSummaries.unshift({
        filename: "source-text",
        summary: sourceText.slice(0, 12000)
      });
    }

    const payload = {
      ...metadata,
      date_range: metadata.date_range || String(body.date_range || "").trim(),
      hero_line_1: metadata.hero_line_1 || String(body.hero_line_1 || "").trim(),
      hero_line_2: metadata.hero_line_2 || String(body.hero_line_2 || "").trim(),
      hero_subtitle: metadata.hero_subtitle || String(body.hero_subtitle || "").trim(),
      closing_phrase: metadata.closing_phrase || String(body.closing_phrase || "").trim(),
      notes,
      stories,
      image_filenames: imageFilenames,
      pdf_sources: pdfSummaries,
      placeholder_image: "about-ssa.JPG"
    };

    let generatedHtml = "";
    let modelUsed = "fallback-template";
    let validation = null;
    if (geminiApiKey) {
      try {
        const prompt = buildDraftPrompt(designContract, payload);
        generatedHtml = await callGeminiForNewsletter(geminiApiKey, prompt);
        modelUsed = "gemini-2.5-flash";
      } catch (e) {
        return res.status(502).json({ error: String(e.message || "Gemini draft generation failed.") });
      }
    } else {
      generatedHtml = buildFallbackHtml({ ...payload, placeholder_image: "about-ssa.JPG" });
    }

    validation = validateGeneratedNewsletterHtml(generatedHtml);
    let validationOk = validation.ok;
    let usedRepair = false;

    if (!validationOk && geminiApiKey) {
      try {
        const repairedHtml = await attemptRepairNewsletterHtml(
          geminiApiKey,
          designContract,
          generatedHtml,
          payload,
          validation.error
        );
        const validationAfter = validateGeneratedNewsletterHtml(repairedHtml);
        generatedHtml = repairedHtml;
        usedRepair = true;
        validationOk = validationAfter.ok;
        validation = validationAfter;
        if (validationOk) modelUsed = "gemini-2.5-flash-repair";
      } catch (_e) {
        // Ignore repair errors; return original draft_html for preview.
      }
    }

    if (!validationOk) {
      return res.json({
        ok: true,
        model: modelUsed,
        draft_html: generatedHtml,
        asset_references: savedAssets,
        image_filenames: imageFilenames,
        pdf_sources: pdfSummaries,
        validation_ok: false,
        validation_error: validation.error,
        can_retry: true,
        repair_attempted: usedRepair
      });
    }

    return res.json({
      ok: true,
      model: modelUsed,
      draft_html: generatedHtml,
      asset_references: savedAssets,
      image_filenames: imageFilenames,
      pdf_sources: pdfSummaries
    });
  });

  app.post("/api/newsletter/publish", async (req, res) => {
    const user = getUserFromSession(req.header("x-session-token"));
    if (!user) return res.status(401).json({ error: "Invalid session." });
    if (!canManageNewsletter(user)) return res.status(403).json({ error: "You do not have newsletter permissions." });

    const body = req.body || {};
    const metadata = validateEditPayload(body);
    const html = String(body.draft_html || "").trim();
    if (!html) return res.status(400).json({ error: "draft_html is required." });
    const validation = validateGeneratedNewsletterHtml(html);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const archive = readJson(storage.archivePath, []);
    const state = getCurrentNewsletterState(storage);
    const now = new Date();
    const nowIso = now.toISOString();
    const monthNum = mapMonthName(metadata.month) || now.getMonth() + 1;
    const slug = slugify(
      metadata.edition_name ||
      `${metadata.month || now.toLocaleString("default", { month: "long" })}-${metadata.year || now.getFullYear()}`
    ) || `newsletter-${Date.now()}`;

    const editionAbs = path.join(storage.editionsDir, `${slug}.html`);
    fs.writeFileSync(editionAbs, html, "utf8");
    fs.writeFileSync(storage.currentHtmlPath, html, "utf8");
    if (newsletterImagesDir) deleteUnusedNewsletterAssets(storage.currentHtmlPath, storage.newsletterRootDir, newsletterImagesDir);

    const imageRefs = extractImageFilenamesFromHtml(html);
    // Archived edition must be self-contained (filename-only image paths).
    for (const filename of imageRefs) {
      const srcAbs = path.join(storage.newsletterRootDir, filename);
      const destAbs = path.join(storage.editionsDir, filename);
      if (fs.existsSync(srcAbs)) fs.copyFileSync(srcAbs, destAbs);
    }
    const nextRecord = {
      id: slug,
      slug,
      edition_name: metadata.edition_name || `${metadata.month || now.toLocaleString("default", { month: "long" })} Edition`,
      month: metadata.month || now.toLocaleString("default", { month: "long" }),
      month_index: monthNum,
      year: metadata.year || now.getFullYear(),
      date_range: metadata.date_range || "",
      hero_line_1: metadata.hero_line_1 || "",
      hero_line_2: metadata.hero_line_2 || "",
      hero_subtitle: metadata.hero_subtitle || "",
      closing_phrase: metadata.closing_phrase || "",
      html_path: `newsletters/editions/${slug}.html`,
      status: "current",
      created_at: nowIso,
      published_at: nowIso,
      published_by: user.email,
      image_references: imageRefs,
      source_pdfs: Array.isArray(body.pdf_sources) ? body.pdf_sources : [],
      source_summary: String(body.source_summary || body.notes || "").trim(),
      asset_references: Array.isArray(body.asset_references) ? body.asset_references : []
    };

    const nextArchive = archive.map((entry) =>
      state.current && String(entry.id) === String(state.current.id)
        ? { ...entry, status: "archived", archived_at: nowIso }
        : entry
    );
    nextArchive.unshift(nextRecord);
    writeJson(storage.archivePath, nextArchive);
    writeJson(storage.currentPath, {
      current_id: nextRecord.id,
      current_html_path: "newsletters/current.html",
      updated_at: nowIso
    });

    const shouldPush = body.push_to_github !== false;
    if (!shouldPush) return res.json({ ok: true, pushed: false, current: nextRecord });

    const cfg = parseGithubRepoConfig();
    if (!cfg) {
      return res.status(400).json({
        error: "GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH are not fully configured."
      });
    }

    try {
      await pushFileToGithub(cfg, "data/newsletters.json", storage.archivePath, "Publish SSA newsletter archive update");
      await pushFileToGithub(cfg, "data/current-newsletter.json", storage.currentPath, "Publish SSA current newsletter pointer");
      await pushFileToGithub(cfg, "newsletters/current.html", storage.currentHtmlPath, "Publish SSA current newsletter");
      await pushFileToGithub(cfg, `newsletters/editions/${slug}.html`, editionAbs, "Publish SSA monthly newsletter edition");
      const logoAbs = path.join(storage.newsletterRootDir, "logo-v3.png");
      if (fs.existsSync(logoAbs)) {
        await pushFileToGithub(cfg, "newsletters/logo-v3.png", logoAbs, "Ensure SSA newsletter logo is available");
      }
      for (const filename of imageRefs) {
        const absRoot = path.join(storage.newsletterRootDir, filename);
        if (fs.existsSync(absRoot)) {
          await pushFileToGithub(cfg, `newsletters/${filename}`, absRoot, `Publish newsletter asset ${filename}`);
        }
        const absEditions = path.join(storage.editionsDir, filename);
        if (fs.existsSync(absEditions)) {
          await pushFileToGithub(cfg, `newsletters/editions/${filename}`, absEditions, `Publish newsletter edition asset ${filename}`);
        }
      }
      return res.json({ ok: true, pushed: true, current: nextRecord });
    } catch (e) {
      return res.status(502).json({ error: String(e.message || "GitHub publish failed.") });
    }
  });
}

module.exports = {
  setupNewsletterPlatform,
  canManageNewsletter,
  ensureNewsletterStorage
};

