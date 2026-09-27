# olcorp.ca SEO Changelog

## 2026-09-27 (Phase 2, page 1: SINP pillar page)
- [Content] sinp-immigration-consultant.html: new pillar page at /sinp-immigration-consultant (about 3,500 words). Sections: overview (2026 allocation and sector tiers), who SINP is for, pathways, Employer Certification (#employer-certification), EPA (#epa), nomination (#nomination), work permit (#work-permit), permanent residence (#permanent-residence), help for applicants (#applicants) and employers (#employers), common mistakes (#mistakes), representation (#representation), credentials (#credentials), FAQ (#faq), official sources (#sources)
- [Content] Every policy statement cites saskatchewan.ca or canada.ca; visible "Last reviewed: September 27, 2026"; Entrepreneur and Farm pathways shown as closed since March 27, 2025
- [E-E-A-T] Credentials card and verification section (CICC R711813, SK licence 000996, CICC and CAPIC, both offices); SINP counts taken from the homepage Proven Results grid (62, 50, 23, 11) with outcome disclaimer
- [SEO] Title "SINP Immigration Consultant in Saskatchewan | OLCORP", unique meta description, H1 "Licensed SINP Immigration Consultant in Saskatchewan", self-referencing canonical, robots index/follow, Open Graph and Twitter tags
- [Schema] ProfessionalService, Person, WebSite, WebPage (author, reviewedBy, lastReviewed), Service and BreadcrumbList. No FAQPage markup (Google limits FAQ rich results to government and health sites) and no review markup
- [Internal links] index.html: "SINP" added to the main menu and mobile menu; SINP Nomination & PR, SINP Employer Certification and EPA service cards now link to the pillar (page, #employer-certification, #epa); contextual link in the Saskatchewan Specialist card; footer SINP links now go to #nomination and #employers
- [Technical] sitemap.xml: added /sinp-immigration-consultant

## 2026-09-27 (Phase 1: technical foundation and homepage)
- [Technical] robots.txt: created; allows crawling, blocks /.netlify/ and /l/ short links, points to the sitemap
- [Technical] sitemap.xml: created with /, /fee-estimator, /book, /rental-estimator
- [Technical] olcorp-landing.html: removed (duplicate of the homepage, not in use); /olcorp-landing and /olcorp-landing.html now 301 to /
- [Technical] _redirects: forced 301s for /index.html and the landing page; added /carrental (old Wix URL) 301 to /rental-estimator; grouped and commented rules
- [SEO] index.html: new title, meta description, canonical, og:site_name, og:locale; OG description updated to 391 approvals and SINP focus
- [Schema] index.html: added ProfessionalService (Regina address, Saskatoon location, phone 639-554-9791), Person (Jayvee Olfindo with CICC R711813 and SK licence 000996 credentials) and WebSite JSON-LD. No review markup (Google does not allow self-serving review snippets)
- [SEO] index.html: H1 is now "Saskatchewan Immigration Consultant Specializing in SINP" (shown in the existing badge); the tagline keeps its exact look as a styled paragraph
- [Content] index.html: approval count unified at 391 (hero, trust card, bio, OG text); bio now reads "As of September 2026"
- [Content] index.html: SINP Employer Certification description corrected (employer registration); new Employer Position Assessment (EPA) service line added
- [Content] index.html: em and en dashes removed from site copy (client review quotes and Jayvee's personal quote left verbatim)
- [Fix] index.html: removed the "Save your portrait as portrait.jpg" placeholder text that Google had indexed
- [Fix] index.html: 11 footer service links and the logo link no longer point to "#"
- [Fix] All consultation CTAs now go to /book (two went straight to Calendly)
- [Local] Footer: full addresses with city names; Saskatoon now links to its own map address instead of the Regina Google Business Profile
- [E-E-A-T] Footer: licence numbers now link to the CICC public register and the saskatchewan.ca licensed consultant list for verification; footer-bottom links were dark on dark (the old CICC link was invisible) and are now light and underlined
- [UX] Rental Car removed from the top menu and mobile menu; now a footer link ("Car rentals in Regina"). Mobile sticky bar changed from Facebook / Rental Car to Call / Book Consultation
- [Performance] portrait.webp (640x800, 39 KB) replaces the 1 MB portrait.jpg on the homepage; explicit width/height on portrait and logos; footer logo lazy-loaded; removed old Wix CDN logo fallbacks (index, fee-estimator)
- [Fix] index.html: hamburger icon no longer shows on desktop next to the full menu (CSS order bug)
- [Accessibility] Portrait "View Full Profile" is now keyboard accessible
- [SEO] fee-estimator.html, book.html, rental-estimator.html: titles, meta descriptions, canonicals, OG tags; BreadcrumbList on fee-estimator and book; rental OG URL and image height corrected
- [Technical] car-carnival and car-wrangler: AVIF files renamed to .avif for display; real 1200px JPEGs created for Facebook link previews (Facebook does not read AVIF)
- [Technical] eta-intake.html, car-rental-checklist.html, service-contract.html: noindex, nofollow
- [Technical] Internal fee estimator links use /fee-estimator
