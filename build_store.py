#!/usr/bin/env python3
"""
build_store.py — generates store.html, request.html and every product page
for shellkey.company.

Run it from the site root:      python build_store.py

Edit PRODUCTS below to change anything. Add a product, re-run, done.
Status values:
    "available" -> shows a PayPal Buy button (set paypal="...")
    "soon"      -> shows Coming Soon + Request Early Access
    "quote"     -> shows Request a Quote
"""

import html
import os
import re
import time

OUT_PRODUCTS = "products"
IMG = "assets/img"

# --------------------------------------------------------------------------
# CATALOG
# --------------------------------------------------------------------------

CATEGORIES = [
    ("software", "Software Subscriptions",
     "Shell Key's own systems, hosted and supported. Subscribe online, get access the same "
     "business day, cancel with one email."),
    ("wallcharts", "Digital Wall Charts",
     "Power BI wall charts built on live turnarounds — the same boards used to run "
     "equipment, piping, valve and workpack scope on projects from $75M to $3.8B."),
    ("apps", "Mobile &amp; Desktop Applications",
     "Field-ready apps for inspection, tracking and closeout. Built for gloves, "
     "daylight and spotty signal."),
    ("builds", "Built For You",
     "Portals, websites and custom systems. Fixed scope, fixed price, fixed date — "
     "you know what you are getting before anyone starts."),
    ("training", "Training &amp; Procedures",
     "Courses and SOPs written for industrial execution, using industrial data."),
    ("guides", "Guides &amp; eBooks",
     "Practical step-by-step guides. Instant download, delivered by email."),
    ("free", "Free Tools",
     "Useful on their own. No purchase, no catch."),
]

# PayPal links. Subscription plans use the hosted subscribe URL; one-time items use
# the "Buy Now" hosted button URL (https://www.paypal.com/ncp/payment/XXXX).
# Any link still starting with PAYPAL_LINK_ is a placeholder: the button becomes
# "Request This" until you paste the real one.
PAYPAL_BIDBOARD = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-1MD1072905987273YNKSDYIY"
PAYPAL_INSPECTION = "PAYPAL_LINK_INSPECTION_ANNUAL"      # create plan: Shell Key Inspection System, $2,000 / year
PAYPAL_FAMILY_FINANCE = "PAYPAL_LINK_FAMILY_FINANCE"    # Buy Now button: Family Finance full version, $49.95
PAYPAL_CONTRACTOR = "PAYPAL_LINK_CONTRACTOR_MONTHLY"       # plan: Contractor System, $75 first month then $295/mo
PAYPAL_CONTRACTOR_AI = "PAYPAL_LINK_CONTRACTOR_AI_MONTHLY" # plan: Contractor System + AI, $75 first month then $495/mo
PAYPAL_PROJECT = "PAYPAL_LINK_PROJECT_MONTHLY"             # plan: Project System, $75 first month then $295/mo
PAYPAL_PROJECT_AI = "PAYPAL_LINK_PROJECT_AI_MONTHLY"       # plan: Project System + AI, $75 first month then $495/mo
PAYPAL_4D = "PAYPAL_LINK_4D_MONTHLY"                       # plan: 4D Schedule Sequence service, $295 first month then $495/mo
PAYPAL_API653 = "PAYPAL_LINK_API653_ANNUAL"           # plan: API 653 IM, $75 / year
PAYPAL_API1104 = "PAYPAL_LINK_API1104_ANNUAL"         # plan: API 1104 IM, $75 / year
PAYPAL_AWSCWI = "PAYPAL_LINK_AWSCWI_ANNUAL"           # plan: AWS-CWI IM, $75 / year
PAYPAL_BLUELINK = "PAYPAL_LINK_BLUELINK_ANNUAL"       # plan: BlueLink Inspection Management System, $2,400 / year
PAYPAL_TURNAROUND = "PAYPAL_LINK_TURNAROUND_ANNUAL"   # plan: Turnaround Management System, $2,400 / year
PAYPAL_WEBSITE_START = "PAYPAL_LINK_WEBSITE_START"       # Buy Now button: AI Website Studio start, $50
PAYPAL_TRAINING_COURSE = "PAYPAL_LINK_TRAINING_COURSE"   # Buy Now button: one course, $39
PAYPAL_TRAINING_ALL = "PAYPAL_LINK_TRAINING_ALL"         # Buy Now button: all-access year, $99

PRODUCTS = [
    # ---------------- SOFTWARE SUBSCRIPTIONS ----------------
    dict(slug="contractor-system", cat="software", cover=True, badge="New",
         name="Shell Key Contractor System",
         tagline="One project. Every contractor. One set of numbers.",
         img=f"{IMG}/covers/contractor-system.jpg",
         price="$75", price_note="first month, then $295 / mo &middot; $495 / mo with AI assistance", status="available", subscribe=True,
         paypal=PAYPAL_CONTRACTOR, paypal_alt=("Subscribe with AI assistance", PAYPAL_CONTRACTOR_AI),
         demo="demos/contractor-system.html",
         short="Project tracking for owners and general contractors running multiple contractors. Each contractor submits a weekly return against the master schedule; you approve it, and progress, forecast finish, forecast cost, manpower, safety, materials and inspection roll up on one screen.",
         bullets=["Contractor returns: submit, review, approve, one register",
                  "Master schedule, progress and S-curves, estimates and cost",
                  "Manpower, safety, materials and delivery, inspection and turnover",
                  "Guided walkthrough that reads each screen to you"],
         detail=[
           ("What it is",
            "A project tracking portal built around the contractor reporting cycle: every contractor reports against the same schedule, you approve the returns, and the project position updates from approved data only."),
           ("Who it is for",
            "Owner project teams, EPC and general contractors managing several subcontractors on a capital project, expansion or outage."),
           ("What you get",
            "Your project set up in the portal with contractors, schedule and areas; setup and a walkthrough with Kirby; support by phone and email. The AI-assistance tier adds AI-written status summaries, exception explanations and report drafting."),
           ("How billing works",
            "$75 for the first month so you can run it on a real project, then $295 a month (standard) or $495 a month (with AI assistance) until cancelled. Cancel any time by emailing support@shellkey.company; the introductory month is available once per company."),
         ]),

    dict(slug="project-system", cat="software", cover=True, badge="New",
         name="Shell Key Project System",
         tagline="From approved scope to verified turnover.",
         img=f"{IMG}/covers/project-system.jpg",
         price="$75", price_note="first month, then $295 / mo &middot; $495 / mo with AI assistance", status="available", subscribe=True,
         paypal=PAYPAL_PROJECT, paypal_alt=("Subscribe with AI assistance", PAYPAL_PROJECT_AI),
         demo="demos/project-system.html",
         short="Work-package project control: approved worklist, work packages, schedule and milestones, progress updates, resources and cost, procurement and deliveries, quality and system turnover, documents and site conditions, template center, audit trail and report builder.",
         bullets=["Approved worklist &rarr; work packages &rarr; progress &rarr; turnover",
                  "Earned progress, SPI and forecast that follows the remaining plan",
                  "Procurement, deliveries, quality and system turnover",
                  "Template center, audit trail and report builder"],
         detail=[
           ("What it is",
            "A work-packaging (AWP-style) project control system. Scope is approved into a worklist, broken into work packages with manhours, executed and progressed, and verified through quality and system turnover &mdash; with cost, procurement and documents attached along the way."),
           ("Who it is for",
            "Project controls groups, construction managers and turnaround planners who want scope, progress, cost and turnover in one system instead of four spreadsheets."),
           ("What you get",
            "Your company workspace with templates, users and your first project loaded; setup and a walkthrough with Kirby; support by phone and email. The AI-assistance tier adds plain-words status summaries generated from today's numbers, package write-ups and report drafting."),
           ("How billing works",
            "$75 for the first month, then $295 a month (standard) or $495 a month (with AI assistance) until cancelled. Cancel any time by emailing support@shellkey.company; the introductory month is available once per company."),
         ]),

    dict(slug="4d-schedule-sequence", cat="software", cover=True, badge="Service",
         name="4D Schedule Sequence",
         tagline="Your P6 schedule on your plot plan, animated week by week.",
         img=f"{IMG}/covers/4d-schedule-sequence.jpg",
         price="$295", price_note="first month, then $495 / month &middot; built and updated weekly by Shell Key", status="available", subscribe=True,
         paypal=PAYPAL_4D,
         demo="demos/4d-schedule-sequence.html",
         short="A service, not just software. Send your P6 or MS Project schedule and a plot plan or model image; Shell Key builds a 4D construction sequence you can play forward by day, week or month &mdash; every activity appearing where it happens, green while it is being installed, with S-curves and a CWA timeline. Updated every week from your schedule update.",
         bullets=["Built from your schedule and plot plan &mdash; nothing to install",
                  "Play the build-up by CWA, discipline, actual and forecast",
                  "S-curves, CWA timeline and work-at-this-date list",
                  "Updated weekly by Shell Key from your progress update"],
         detail=[
           ("What it is",
            "A 4D (schedule-driven) construction sequence of your project that runs in a browser. Foundations, steel, equipment, piping, E&amp;I, paint and test/turnover appear on the plot as their P6 activities progress, colored by discipline, green while in progress, with baseline comparison and a forecast to mechanical completion."),
           ("Who it is for",
            "Owners, EPCs and contractors who need leadership, the field and the client to see the plan the same way &mdash; without a Navisworks license on every desk."),
           ("What you get",
            "Shell Key builds the sequence from your XER / MPP and plot plan or model image within a week, then refreshes it after every schedule update. Delivered as a private link you can share; save-frame images for reports. Try the demo &mdash; it is a real 668-activity plant sequence with the names removed."),
           ("How billing works",
            "$295 for the first month (includes the initial build), then $495 a month while the project is active, cancel any time by emailing support@shellkey.company. Larger projects or multiple areas are quoted."),
         ]),

    dict(slug="bid-board", cat="software", cover=True,
         name="Bid Board",
         tagline="Every Louisiana public bid, scored for your company, on one board.",
         img=f"{IMG}/covers/bid-board.jpg",
         price="$75", price_note="first month, then $295 / month", status="available", subscribe=True,
         paypal=PAYPAL_BIDBOARD, feature=True,
         short="Bid intelligence for Louisiana contractors. LaPAC, DOTD, parish and SAM.gov bids in one place, go / no-go scoring against your license and certifications, a company vault for your documents, and a bid-kit generator that assembles the government package.",
         bullets=["All open Louisiana public bids on one board",
                  "Go / no-go score matched to your license class",
                  "Company vault: licenses, certs, insurance, forms",
                  "Bid kit generator builds the submission package"],
         detail=[
           ("What it is",
            "A subscription portal that watches every Louisiana public procurement source, "
            "scores each bid against your license classifications and certifications, keeps "
            "your company documents ready in a vault, and builds the bid package so you can "
            "go from 'Go' to a submitted bid without hunting for forms."),
           ("Who it is for",
            "Louisiana general contractors, subcontractors and specialty contractors who bid "
            "state, parish, municipal or federal work and are tired of missing lettings or "
            "wasting a week on a bid they should have passed on."),
           ("What you get",
            "A company account on the Bid Board portal, the readiness check for each bid, the "
            "vault, the bid-kit generator, and email support from the person who built it."),
           ("How billing works",
            "$75 for the first month so you can see it work on real bids, then $295 a month "
            "until you cancel. Cancel any time by emailing support@shellkey.company; access "
            "ends at the close of the billing period and no further charges are made. The $75 "
            "introductory month is available once per company."),
         ]),

    dict(slug="family-finance", cat="software", cover=True, badge="Staff Pick",
         name="Family Finance Management System",
         tagline="Your household's financial command center.",
         img=f"{IMG}/covers/family-finance.jpg",
         price="$49.95", price_note="one-time &middot; full version", status="available",
         paypal=PAYPAL_FAMILY_FINANCE,
         demo="demos/family-finance.html",
         short="Plan the month, track every dollar, and see where the family stands at a glance. Guided setup, monthly budget, bills and recurring payments, savings goals, debt payoff, net worth, a financial-health score with a recommended next action, calendar and annual reports.",
         bullets=["Guided setup walks the whole family through it",
                  "Budget, bills, savings goals, debt payoff, net worth",
                  "Financial-health score with a best next action",
                  "Your data stays on your computer &mdash; nothing uploaded"],
         detail=[
           ("What it is",
            "A complete household finance system that runs in your browser. Enter income, bills "
            "and a budget once; from then on it tracks spending against plan, funds savings goals, "
            "schedules debt payoff, and scores your financial health every month with one "
            "recommended action."),
           ("Who it is for",
            "Families and couples who want one place for the whole picture without a subscription "
            "or handing bank logins to an app."),
           ("What you get",
            "The full version as a single file that opens in any modern browser on Windows, Mac, "
            "phone or tablet. Backup and restore, print-ready monthly summaries, annual reports, and "
            "free updates for a year. Try the free demo first &mdash; everything works, so you know "
            "exactly what you are buying."),
           ("What you need",
            "A browser. Data is stored locally on your device; export a backup from Settings any time."),
         ]),

    dict(slug="api-653-im", cat="software", cover=True, 
         name="API 653 IM",
         tagline="Tank inspection tracking from assignment to approved report.",
         img=f"{IMG}/covers/api-653-im.jpg",
         price="$75", price_note="per year &middot; single user", status="available", subscribe=True,
         paypal=PAYPAL_API653,
         demo="demos/api-653-im.html",
         short="Inspection management for API 653 aboveground storage tank work. Track what is assigned, in progress, waiting review, approved, accepted or overdue; log recommendations; issue consistent reports; and keep the whole history in one place.",
         bullets=[
                  "Dashboard of outstanding, in-progress, review and overdue inspections",
                  "Recommendations with follow-up tracking",
                  "Guided workflow and consistent report format",
                  "Tutorials and API 653 reference built in"],
         detail=[
           ("What it is",
            "A single-file inspection management application for API 653 tank inspectors and the companies that employ them. Runs in the browser, no install."),
           ("Who it is for",
            "API 653 inspectors, inspection companies, and owner-operators tracking tank inspection programs."),
           ("What you get",
            "One named-user license for a year: the full application, guided tutorials, PDF reports, CSV import and export, and email support. Try the free demo first &mdash; it is the complete system with sample data."),
           ("How billing works",
            "$75 per year per named user. Renews annually; cancel by email before the renewal date. Company packages for five or more inspectors are available by quote."),
         ]),

    dict(slug="api-1104-im", cat="software", cover=True, badge="Most Popular",
         name="API 1104 IM",
         tagline="Weld traceability, NDE, repairs and release for pipeline work.",
         img=f"{IMG}/covers/api-1104-im.jpg",
         price="$75", price_note="per year &middot; single user", status="available", subscribe=True,
         paypal=PAYPAL_API1104,
         demo="demos/api-1104-im.html",
         short="Pipeline weld inspection management to API 1104. Every weld from fit-up through visual, NDE, indications, repair, re-inspection and release &mdash; with welder and procedure traceability and reports the client accepts.",
         bullets=[
                  "Weld register with line, spread, welder and procedure",
                  "NDE results, indications, repair control and release",
                  "Field tutorials for technicians",
                  "Reports and CSV export"],
         detail=[
           ("What it is",
            "A pipeline weld inspection management application built around the API 1104 workflow: weld record, VT, NDE disposition, repair closure and release for coating and lowering-in."),
           ("Who it is for",
            "Pipeline welding inspectors, NDE companies and pipeline contractors who need defensible weld traceability."),
           ("What you get",
            "One named-user license for a year: the full application, guided tutorials, PDF reports, CSV import and export, and email support. Try the free demo first &mdash; it is the complete system with sample data."),
           ("How billing works",
            "$75 per year per named user. Renews annually; cancel by email before the renewal date. Company packages for five or more inspectors are available by quote."),
         ]),

    dict(slug="aws-cwi-im", cat="software", cover=True, 
         name="AWS-CWI IM",
         tagline="Welding quality control for fabrication and field welds.",
         img=f"{IMG}/covers/aws-cwi-im.jpg",
         price="$75", price_note="per year &middot; single user", status="available", subscribe=True,
         paypal=PAYPAL_AWSCWI,
         demo="demos/aws-cwi-im.html",
         short="Welding inspection management for AWS Certified Welding Inspectors. Weld register, WPS/PQR/WPQ qualification traceability, visual inspection, NDE, corrective actions, approvals and turnover readiness on one dashboard.",
         bullets=[
                  "Weld register and qualification (WPS/PQR/WPQ) control",
                  "Visual inspection, NDE and repair closure",
                  "Corrective actions and NCR tracking",
                  "Reports, tutorials and AWS reference"],
         detail=[
           ("What it is",
            "A welding quality management application for CWIs covering structural, pressure and process welds: qualifications, inspections, NDE, corrective actions and approvals."),
           ("Who it is for",
            "AWS CWIs, fabrication shops, structural steel and process equipment contractors."),
           ("What you get",
            "One named-user license for a year: the full application, guided tutorials, PDF reports, CSV import and export, and email support. Try the free demo first &mdash; it is the complete system with sample data."),
           ("How billing works",
            "$75 per year per named user. Renews annually; cancel by email before the renewal date. Company packages for five or more inspectors are available by quote."),
         ]),

    dict(slug="bluelink-inspection", cat="software", cover=True, 
         name="BlueLink Inspection Management System",
         tagline="Turnaround inspection portal: packages, NDE requests, reports, audit.",
         img=f"{IMG}/covers/bluelink-inspection.jpg",
         price="$2,400", price_note="per year &middot; per company", status="available", subscribe=True,
         paypal=PAYPAL_BLUELINK,
         demo="demos/bluelink-inspection.html",
         short="A branded inspection management portal for turnarounds and projects. Packages and inspections, NDE / API / AWS requests, reports and recommendations, daily log and audit trail, turnaround schedule, users and permissions &mdash; configured for your facility and standards.",
         bullets=[
                  "Packages &amp; inspections tied to the turnaround schedule",
                  "NDE / API / AWS request workflow",
                  "Reports, recommendations, daily log and audit",
                  "Users, permissions and your company branding"],
         detail=[
           ("What it is",
            "A full inspection management portal for a turnaround or capital project, branded for your company, with administrator controls, permissions, CSV import/export, photos and PDF reporting."),
           ("Who it is for",
            "Inspection companies and owner inspection groups running a turnaround or multi-package project."),
           ("What you get",
            "The portal configured with your logo, facility, standards and users; setup and walkthrough with Kirby; support for the year. Try the free demo &mdash; everything works with sample data."),
           ("How billing works",
            "$2,400 per year per company. Renews annually; cancel by email before the renewal date."),
         ]),

    dict(slug="inspection-system", cat="software", cover=True, 
         name="NDE OneSystem",
         tagline="Field operations and reporting for NDE companies.",
         img=f"{IMG}/covers/nde-onesystem.jpg",
         price="$2,000", price_note="per year &middot; per company", status="available", subscribe=True,
         paypal=PAYPAL_INSPECTION,
         demo="demos/inspection-system.html",
         short="The NDE operations system already running at a Louisiana inspection company. Requests, dispatch, field inspections, technician certifications, review, controlled reports and field performance &mdash; with your company name on every screen.",
         bullets=[
                  "Request pipeline from new to complete",
                  "Technicians, certifications and 14-day workload",
                  "Field results, review and controlled reports",
                  "Clients, projects and assets"],
         detail=[
           ("What it is",
            "An NDE operations and reporting system: NDE requests, assignment, field inspection results, Level III review, controlled report issue, and performance dashboards."),
           ("Who it is for",
            "NDE and inspection companies, QA/QC managers, and owner-side inspection groups."),
           ("What you get",
            "The system set up under your company name, the field workflow for technicians, setup and a walkthrough with Kirby, and support by phone and email for the year."),
           ("How billing works",
            "$2,000 per year for the company &mdash; no per-user fees. Renews annually; cancel by email before the renewal date."),
         ]),

    dict(slug="turnaround-management", cat="software", cover=True, 
         name="Turnaround Management System",
         tagline="Schedule, cost, readiness, execution, quality, safety and turnover — one command center.",
         img=f"{IMG}/covers/turnaround-management.jpg",
         price="$2,400", price_note="per year &middot; per company", status="available", subscribe=True,
         paypal=PAYPAL_TURNAROUND,
         # demo="demos/turnaround-management.html",   # add the demo file, uncomment, rebuild
         short="The Shell Key Turnaround Management System: an executive command center with planning and estimating, integrated schedule, work packages, daily execution, quality and inspection, safety and workforce, constraints, turnover and reports &mdash; branded for your company.",
         bullets=[
                  "Command center with progress, constraints and turnover",
                  "Work packages, daily execution and integrated schedule",
                  "Quality, safety, constraints and deviations",
                  "Guided tour, reports and administrator licensing"],
         detail=[
           ("What it is",
            "A complete turnaround management portal with administrator controls, user access, data import/export, photos, audit history and PDF reporting, branded with your company logo, workflows and forms."),
           ("Who it is for",
            "Turnaround managers, planners, owner reps and contractors running an outage from readiness through startup."),
           ("What you get",
            "The portal configured for your company and turnaround; setup and walkthrough with Kirby; support for the year. Try the free demo &mdash; a full turnaround with sample data."),
           ("How billing works",
            "$2,400 per year per company. Renews annually; cancel by email before the renewal date."),
         ]),

    # ---------------- DIGITAL WALL CHARTS ----------------
    dict(slug="digital-wall-charts", cat="wallcharts",
         name="Digital Wall Charts",
         tagline="Your whole turnaround scope on one board set.",
         img=f"{IMG}/dashboards/001-ProjectSummary.jpg",
         gallery=[
             (f"{IMG}/dashboards/001-ProjectSummary.jpg", "Project Summary — every discipline at a glance"),
             (f"{IMG}/dashboards/002-Equipment.jpg", "Equipment — vessels, towers and exchangers"),
             (f"{IMG}/dashboards/003-Flanges.jpg", "Flanges — break, inspect, re-gasket, torque"),
             (f"{IMG}/dashboards/004-Piping.jpg", "Piping — line and spool progress"),
             (f"{IMG}/dashboards/005-Valves.jpg", "Valves — pulled, shopped, tested, reinstalled"),
             (f"{IMG}/dashboards/006-TestPacks.jpg", "Test Packs — readiness and punch burn-down"),
             (f"{IMG}/dashboards/007-WorkPacks.jpg", "Work Packs — planned to closed, with proof"),
             (f"{IMG}/dashboards/008-DailyLog.jpg", "Daily Log — yesterday's work, reported"),
         ],
         price="$697", status="soon", feature=True,
         short="One Power BI report with eight linked views — summary, equipment, flanges, piping, valves, test packs, work packs and daily log. Every discipline, one data model, one file.",
         bullets=["Eight linked views in one report",
                  "One shared data model — load your scope once",
                  "Colour-coded progress at every level",
                  "Sample dataset and mapping guide included"],
         detail=[
           ("What it is",
            "The complete wall chart set as a single Power BI report. Eight views — Summary, "
            "Equipment, Flanges, Piping, Valves, Test Packs, Work Packs and Daily Log — all "
            "driven by one data model, so you load your scope once and every board updates "
            "together. Tab across them the way the field actually works a turnaround."),
           ("Who it is for",
            "Turnaround teams, project controls groups and owner reps who need real completion "
            "status by discipline rather than a percentage somebody estimated on a Friday."),
           ("What you get",
            "The .pbix file with all eight views built, a sample dataset so it renders the "
            "moment you open it, and a mapping sheet listing exactly which columns your scope "
            "export needs to contain."),
           ("What you need",
            "Power BI Desktop, free from Microsoft. Your scope data from Excel or your tracking "
            "system — the mapping sheet lists the fields for each discipline."),
         ]),

    dict(slug="progress-cost-dashboard", cat="wallcharts",
         name="Project Progress &amp; Cost",
         tagline="S-curves, earned value and manpower in one view.",
         img=f"{IMG}/dashboards/Dash1.jpg",
         price="$199", status="soon",
         short="Overall progress against plan, piping and welding progress, manpower curve and earned value.",
         bullets=["Planned vs. earned S-curves", "Manpower loading curve",
                  "Progress gauges by discipline", "Sample dataset included"],
         detail=[
           ("What it is",
            "The board for the monthly report. Overall percent complete against plan, discipline "
            "curves, manpower loading, and where earned value sits against spend."),
           ("Who it is for",
            "Project controls managers and owner reps producing monthly reporting to leadership."),
           ("What you get",
            "The .pbix file, sample data, and the mapping sheet for progress and cost data."),
           ("What you need",
            "Power BI Desktop, a progress export and a cost export. The setup sheet lists the fields."),
         ]),

    dict(slug="digital-project-tracker", cat="wallcharts",
         name="Digital Project Tracker",
         tagline="Every work item and every weld, tracked and reported instantly.",
         img=f"{IMG}/dashboards/WallChart1.PNG",
         gallery=[
             (f"{IMG}/dashboards/WallChart1.PNG", "Hot Work view — permits and work items by WO number"),
             (f"{IMG}/dashboards/WallChart2.PNG", "Weld Report view — buttwelds, sockolets, NDE and repair rates"),
         ],
         price="$697", status="soon",
         short="One tracker covering hot work, cold work, valves, PSVs, blinds, chem clean, flange logs, NDE requests, weld reports and welder certifications — searchable by work order, printable on demand.",
         bullets=["Twenty tracking views in one tool",
                  "Search by work order or package number",
                  "Weld, NDE and welder certification history",
                  "Client-ready reports printed on demand"],
         detail=[
           ("What it is",
            "A single tracker with a view for every category of turnaround work — hot work, cold "
            "work, control valves, EBVs, PSVs, TWs, orifice plates, blinds, chem clean spools, "
            "flange logs, spec summaries, NDE requests, rework, recommendations, weld reports, "
            "weld history, welder certification logs, welder summaries, project summary and "
            "dashboard. Same data, twenty ways of looking at it."),
           ("Who it is for",
            "Turnaround and maintenance teams who need to know what work is live right now, and "
            "QA groups who have to produce a weld or NDE report for an owner without spending a "
            "day assembling it."),
           ("What you get",
            "The tracker with all views built, a sample dataset, and a setup sheet for mapping "
            "your work order and weld registers into it."),
           ("Timeline",
            "In production. If you need it now, request it — priority builds are usually ready "
            "within a few days."),
         ]),

    # ---------------- BUILT FOR YOU ----------------

    # ---------------- APPLICATIONS ----------------
    dict(slug="project-mobile-app", cat="apps",
         name="Project Mobile Application",
         tagline="Your whole project scope, in a hard hat pocket.",
         img=f"{IMG}/apps/SKAppHand.PNG",
         price="from $495", status="quote",
         short="Activities, pipe, valves, vessels, exchangers, heaters, reactors, towers, tanks, photos, QR, NDE, RFI, drawings and dashboards — configured to your project.",
         bullets=["Built around your equipment and scope", "Photo capture with time and location",
                  "QR scanning for tags and packs", "Feeds straight into your wall charts"],
         detail=[
           ("What it is",
            "A project-specific mobile app carrying your actual scope. Modules for activities, "
            "pipe and valves, drums and vessels, exchangers, fin fans, heaters, reactors, tanks "
            "and towers, plus photos, QR scanning, NDE, RFI, drawings, contact list and a live dashboard."),
           ("Who it is for",
            "Owners and contractors who need field data captured once, correctly, by the people "
            "doing the work — instead of transcribed off paper three days later."),
           ("What you get",
            "The app configured to your equipment list and workflow, deployed to your team's "
            "phones, connected to your reporting, with training and 30 days of support."),
           ("Timeline",
            "Typically 4–6 weeks from kickoff, depending on how many modules you need and how "
            "clean the equipment register is."),
         ]),

    dict(slug="code-inspection-app", cat="apps",
         name="Code Inspection Application",
         tagline="Multi-site inspection tracking, built for API work.",
         img=f"{IMG}/apps/CodeProDesk.JPG",
         price="from $495", status="quote",
         short="Site-by-site inspection management with daily logs, RFIs, team assignment and reporting across multiple refineries.",
         bullets=["Multi-site and multi-client", "Daily inspection logs",
                  "RFI and deficiency tracking", "Mobile and desktop"],
         detail=[
           ("What it is",
            "An inspection management app running across multiple sites at once — refineries, "
            "chemical plants, terminals — with each site's scope, team, daily logs and RFIs kept separate but reportable together."),
           ("Who it is for",
            "Inspection companies, third-party agencies and QA groups managing inspectors across "
            "several client sites at the same time."),
           ("What you get",
            "The app configured to your sites and clients, with your report formats, deployed to "
            "your inspectors, plus training and 30 days of support."),
           ("Timeline",
            "Typically 4–6 weeks from kickoff."),
         ]),

    dict(slug="desktop-companion", cat="apps",
         name="Desktop Companion",
         tagline="The office half of the field app.",
         img=f"{IMG}/apps/SKApp4.jpg",
         price="from $495", status="quote",
         short="Work packages, reporting and dashboards in one desktop view for the people running the job from the trailer.",
         bullets=["Work package management", "Reporting hub",
                  "Multi-user with permissions", "Connects to your project databases"],
         detail=[
           ("What it is",
            "The desktop application your office team works in while the field uses the mobile "
            "app — same data, different job. Package management, reporting, and dashboards without "
            "anyone opening a spreadsheet."),
           ("Who it is for",
            "Project teams that have outgrown shared spreadsheets but do not want a full "
            "enterprise system rollout."),
           ("What you get",
            "The application built around your existing workflow, connected to your project data, "
            "with user permissions, training and 30 days of support."),
           ("Timeline",
            "Typically 6–10 weeks from kickoff."),
         ]),


    dict(slug="business-portal", cat="builds",
         name="Business Portal",
         tagline="Owner, contractor and inspector looking at the same truth.",
         img=f"{IMG}/cards/FutureDashboard.JPG",
         price="from $495", status="quote",
         short="One portal where every party sees the same progress, documents, constraints and approvals — instead of trading spreadsheets.",
         bullets=["Role-based access per party", "Document control and approvals",
                  "Live progress and constraint views", "Training and 30 days support"],
         detail=[
           ("What it is",
            "A single portal for a project where the owner, the contractor and the inspection "
            "agency all log in and see the same information, filtered to what each is allowed to see."),
           ("Who it is for",
            "Projects where three or more organisations need to coordinate and are currently doing "
            "it over email attachments."),
           ("What you get",
            "The portal built to your project structure, with role-based access, document control, "
            "approval workflows and live progress views. Training and 30 days of support included."),
           ("Timeline",
            "Typically 6–8 weeks from kickoff."),
         ]),

    dict(slug="custom-dashboard-build", cat="builds",
         name="Custom Dashboard Build",
         tagline="Your data, your WBS, your reporting cycle.",
         img=f"{IMG}/cards/digital6.jpg",
         price="from $495", status="quote",
         short="A Power BI dashboard built against your live sources, connected, refreshing and handed over working.",
         bullets=["Data model against your sources", "P6, SAP, EAM or Excel integration",
                  "Automatic refresh configured", "Team walkthrough and handover"],
         detail=[
           ("What it is",
            "A dashboard built for your project rather than adapted from a template — your data "
            "sources, your breakdown structure, your reporting periods."),
           ("Who it is for",
            "Teams whose reporting need does not fit a standard board, or whose data lives in "
            "systems that need connecting first."),
           ("What you get",
            "The data model, the dashboard, the refresh schedule, and a walkthrough with your team. "
            "You own the file."),
           ("Timeline",
            "Typically 2–4 weeks from kickoff."),
         ]),

    dict(slug="business-website", cat="builds",
         name="Business Website",
         tagline="Built to win work, not design awards.",
         img=f"{IMG}/cards/digital2.jpg",
         price="from $495", status="quote",
         short="A professional site for a contractor, inspection outfit or engineering firm — fast, mobile-first, and yours.",
         bullets=["Up to 6 pages, mobile-first", "Capability and project pages",
                  "Contact and enquiry handling", "Search-ready, you own everything"],
         detail=[
           ("What it is",
            "A straightforward professional website for an industrial services business. Clear "
            "capability pages, real project examples, and an enquiry path that works."),
           ("Who it is for",
            "Contractors, inspection companies and engineering firms whose current site is a "
            "single page from 2015, or who have none at all."),
           ("What you get",
            "The site built, launched, and handed over with the files. No monthly platform fee "
            "unless you want hosting handled."),
           ("Timeline",
            "Typically 2–3 weeks from kickoff."),
         ]),

    # ---------------- TRAINING ----------------
    dict(slug="power-bi-for-project-controls", cat="training",
         name="Power BI for Project Controls",
         tagline="Not a generic Power BI course.",
         img=f"{IMG}/cards/digital3.jpg",
         price="$299", status="soon",
         short="Build a working project controls dashboard from a real P6 export, start to finish.",
         bullets=["P6 and cost data modelling", "The DAX project controls actually needs",
                  "S-curves, earned value, variance", "Working files at every step"],
         detail=[
           ("What it is",
            "A course that builds one real thing: a project controls dashboard from a genuine P6 "
            "export. Every lesson adds to the same file rather than teaching a feature in isolation."),
           ("Who it is for",
            "Schedulers, cost engineers and project controls staff who know their trade but not "
            "Power BI, and are tired of courses built around sales data."),
           ("What you get",
            "The workbook, the sample project data, and the working file at every stage so you "
            "can jump in anywhere."),
           ("What you need",
            "Power BI Desktop, free from Microsoft. No prior Power BI experience assumed."),
         ]),

    dict(slug="p6-for-turnaround-planners", cat="training",
         name="P6 for Turnaround Planners",
         tagline="Schedules that survive contact with the field.",
         img=f"{IMG}/cards/digital5.jpg",
         price="$299", status="soon",
         short="Turnaround scheduling in Primavera P6 — structure, logic, gates, and the defects reviewers look for.",
         bullets=["Turnaround WBS and coding structure", "Logic that holds up under review",
                  "Passing a DCMA 14-point assessment", "Progress and recovery methods"],
         detail=[
           ("What it is",
            "How to build a turnaround schedule that holds together when the unit comes down — "
            "coding structure, logic that reflects real sequence, and the gates that stop work "
            "starting before it can."),
           ("Who it is for",
            "Planners and schedulers moving into turnaround work, or capital-project schedulers "
            "who have just been handed an outage."),
           ("What you get",
            "The workbook, a sample turnaround schedule to work in, and the review checklist used "
            "to grade schedules before they go to the client."),
           ("What you need",
            "Access to Primavera P6. The methods transfer to other tools but the exercises are in P6."),
         ]),

    dict(slug="project-controls-sop-set", cat="training",
         name="Project Controls SOP Set",
         tagline="The procedures you are expected to already have.",
         img=f"{IMG}/cards/digital1.jpg",
         price="$449", status="soon",
         short="Editable, unbranded procedures for schedule development, progress measurement, change control and work pack release.",
         bullets=["Schedule development and maintenance", "Progress measurement and reporting",
                  "Change and trend management", "Work pack release and turnover"],
         detail=[
           ("What it is",
            "A set of written procedures covering the processes every project controls group is "
            "expected to have documented — supplied in Word, unbranded, so you can put your own "
            "logo and terminology on them."),
           ("Who it is for",
            "Contractors and owner teams who need documented procedures for an audit, a "
            "prequalification, or simply because nothing is written down."),
           ("What you get",
            "Editable .docx procedures, the forms and registers each one references, and a "
            "revision block ready for your management system."),
           ("What you need",
            "Microsoft Word. Written to ISO 9001 document structure."),
         ]),

    dict(slug="inspection-qa-sop-set", cat="training",
         name="Inspection &amp; QA SOP Set",
         tagline="Written by a former corporate QA manager.",
         img=f"{IMG}/cards/digital4.jpg",
         price="$449", status="soon",
         short="Quality procedures against API and ASME practice — inspection planning, NDE coordination, deficiency and turnover control.",
         bullets=["Inspection planning and execution", "NDE coordination and reporting",
                  "Deficiency, NCR and punch control", "Turnover and completion packages"],
         detail=[
           ("What it is",
            "Quality procedures for inspection and QA groups working to API and ASME practice, "
            "covering planning through turnover, supplied editable and unbranded."),
           ("Who it is for",
            "Inspection companies, QA departments and contractors who need a documented quality "
            "system for client audits or prequalification."),
           ("What you get",
            "Editable .docx procedures, the inspection and NCR forms they reference, and a "
            "revision block ready for your management system."),
           ("What you need",
            "Microsoft Word. Written to ISO 9001 document structure."),
         ]),

    dict(slug="company-training", cat="training",
         name="Company Training — Delivered",
         tagline="Your team, your data, your systems.",
         img=f"{IMG}/cards/digital2.jpg",
         price="from $2,500 / day", status="quote",
         short="Remote or on site, built around what your group actually struggles with rather than a stock syllabus.",
         bullets=["Power BI, P6 or project controls fundamentals", "Taught against your live project data",
                  "Workbooks and recordings the team keeps", "Follow-up session included"],
         detail=[
           ("What it is",
            "Training delivered to your group using your own project data, so what people learn "
            "on the day is immediately usable on Monday."),
           ("Who it is for",
            "Companies standing up a project controls function, rolling out new reporting, or "
            "with a team that has learned by osmosis and has gaps."),
           ("What you get",
            "The sessions, workbooks and recordings for the team to keep, and one follow-up "
            "session a few weeks later once people have hit real problems."),
           ("Timeline",
            "Usually scheduled within 2–3 weeks. Remote or on site."),
         ]),

    # ---------------- GUIDES (AVAILABLE NOW) ----------------
    dict(slug="learn-power-bi-4-hours", cat="guides",
         name="Learn Power BI in 4 Hours",
         tagline="Dashboard training, start to finish.",
         img=f"{IMG}/covers/learn-power-bi-4-hours.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/V7TFMN9G63VHN",
         short="A training workbook that takes you from opening Power BI to a working dashboard in an afternoon.",
         bullets=["Step-by-step workbook", "Build a real dashboard as you go",
                  "No prior experience needed", "Instant download"],
         detail=[
           ("What it is",
            "A four-hour path from never having opened Power BI to having built a working "
            "dashboard, written as a workbook you follow rather than a reference you search."),
           ("Who it is for",
            "Anyone who needs to produce a dashboard soon and has no time for a forty-hour course."),
           ("What you get",
            "The workbook as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "Power BI Desktop, free from Microsoft."),
         ]),

    dict(slug="learn-adalo-4-hours", cat="guides",
         name="Learn Adalo in 4 Hours",
         tagline="Build a mobile app without writing code.",
         img=f"{IMG}/covers/learn-adalo-4-hours.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/LF2AWTMCGUJT4",
         short="A training workbook that walks you through building a working mobile app in Adalo.",
         bullets=["Step-by-step workbook", "Build a real app as you go",
                  "No coding required", "Instant download"],
         detail=[
           ("What it is",
            "A guided build of a working mobile application in Adalo, from empty project to "
            "something you can install on a phone."),
           ("Who it is for",
            "People who need a simple app for their business or team and do not want to hire a developer."),
           ("What you get",
            "The workbook as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "A free Adalo account."),
         ]),

    dict(slug="adalo-power-bi-connection", cat="guides",
         name="Adalo + Power BI Connection",
         tagline="Get your app's data into a dashboard.",
         img=f"{IMG}/covers/adalo-power-bi-connection.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/Y8H2Q3TB5MJN2",
         short="How to connect an Adalo app to Power BI so the data your app collects becomes a live dashboard.",
         bullets=["Connection setup, step by step", "Data structure guidance",
                  "Refresh configuration", "Instant download"],
         detail=[
           ("What it is",
            "The integration guide that closes the loop — data captured in your Adalo app "
            "flowing into a Power BI dashboard that refreshes on its own."),
           ("Who it is for",
            "Anyone who has built an app that collects data and now needs to report on it properly."),
           ("What you get",
            "The guide as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "An Adalo app and Power BI Desktop."),
         ]),

    dict(slug="ai-business-partner", cat="guides",
         name="AI Business Partner",
         tagline="Practical AI for office work.",
         img=f"{IMG}/covers/ai-business-partner.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/ELQVTJCHCBLFW",
         short="A practical guide to using AI to do better in any office role.",
         bullets=["Everyday office workflows", "Prompt patterns that work",
                  "Practical, not theoretical", "Instant download"],
         detail=[
           ("What it is",
            "A working guide to using AI tools for the tasks an office role actually involves — "
            "writing, summarising, analysing and organising."),
           ("Who it is for",
            "Anyone in an office role who keeps hearing they should be using AI and wants a "
            "practical starting point."),
           ("What you get",
            "The guide as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "Access to any mainstream AI assistant."),
         ]),

    dict(slug="ai-money", cat="guides",
         name="AI Money",
         tagline="Content creation and publishing workflows.",
         img=f"{IMG}/covers/ai-money.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/228H7RS4RTJSS",
         short="A system for creating and publishing content using AI tools.",
         bullets=["End-to-end content workflow", "Publishing systems",
                  "Repeatable process", "Instant download"],
         detail=[
           ("What it is",
            "A documented workflow for producing and publishing content with AI assistance, "
            "built as a repeatable system rather than a list of tips."),
           ("Who it is for",
            "People building a content or publishing side income who need a process to follow."),
           ("What you get",
            "The guide as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "Access to any mainstream AI assistant."),
         ]),

    dict(slug="ai-freelancer", cat="guides",
         name="AI Freelancer",
         tagline="Remote income and client delivery.",
         img=f"{IMG}/covers/ai-freelancer.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/EL78764EMBF2C",
         short="Systems for finding remote work and delivering it with AI assistance.",
         bullets=["Finding and winning clients", "Delivery systems",
                  "Pricing guidance", "Instant download"],
         detail=[
           ("What it is",
            "A guide to building a freelance income using AI tools to deliver more work in less "
            "time, covering both the finding and the doing."),
           ("Who it is for",
            "People starting or growing a freelance practice who want to move faster than hourly work allows."),
           ("What you get",
            "The guide as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "Access to any mainstream AI assistant."),
         ]),

    dict(slug="free-landing-page", cat="guides",
         name="Free Landing Page",
         tagline="Build a landing page fast and start selling.",
         img=f"{IMG}/covers/free-landing-page.jpg",
         price="", status="available", cover=True, paypal="https://www.paypal.com/ncp/payment/5CNV9233Y38MG",
         short="A beginner's guide to building a landing page quickly and starting to sell from it.",
         bullets=["Fast, no-code build", "Written for beginners",
                  "Get selling quickly", "Instant download"],
         detail=[
           ("What it is",
            "A short, practical guide to getting a landing page live and taking payments, aimed "
            "at someone who has never built one."),
           ("Who it is for",
            "Anyone with something to sell and no website yet."),
           ("What you get",
            "The guide as a PDF, delivered by email immediately after payment."),
           ("What you need",
            "Nothing but a browser."),
         ]),

    # ---------------- FREE ----------------
    dict(slug="wall-chart-starter", cat="free",
         name="Wall Chart Starter",
         tagline="One working view of the real thing, free.",
         img=f"{IMG}/dashboards/002-Equipment.jpg",
         price="Free", status="soon",
         short="The Equipment view from the Digital Wall Charts, as a complete working Power BI file. Load your own equipment list and it renders.",
         bullets=["A real .pbix file, not a screenshot",
                  "Load your equipment list and it works",
                  "Same data model as the full set",
                  "Straight upgrade path to all eight views"],
         detail=[
           ("What it is",
            "One complete view from the Digital Wall Charts \u2014 the Equipment board \u2014 as a "
            "working Power BI file you can open, connect and use on a live job. Not a demo, not a "
            "watermarked preview. The real thing, one view of eight."),
           ("Who it is for",
            "Anyone who wants to know whether these boards fit how their team works before paying "
            "for the full set. If the Equipment view earns its place on your job, the other seven "
            "will too."),
           ("What you get",
            "The .pbix file, a sample equipment dataset so it renders the moment you open it, and "
            "the mapping sheet showing which columns your own export needs to contain."),
           ("Why it is free",
            "Because a screenshot cannot tell you whether a board is any good, and using one on "
            "your own data can. If it works for you, the full eight-view set is there when you "
            "want it."),
         ]),

    dict(slug="schedule-health-scan", cat="free",
         name="Schedule Health Scan",
         tagline="DCMA 14-point analysis of any P6 schedule.",
         img=f"{IMG}/cards/digital6.jpg",
         price="Free", status="soon",
         short="Point it at a P6 XER file and it finds the open ends, negative float, invalid actuals and hard constraints — then names the activities.",
         bullets=["All 14 DCMA checks", "Names the failing activities",
                  "Runs locally — nothing uploads", "JSON output for your own reporting"],
         detail=[
           ("What it is",
            "A tool that reads a Primavera P6 XER export and runs the full DCMA 14-point schedule "
            "assessment, listing the activities behind every failed check rather than just scoring them."),
           ("Who it is for",
            "Schedulers, planners and owner reps who receive contractor schedules and need to know "
            "quickly whether the schedule is sound before they rely on the dates."),
           ("Why it runs on your machine",
            "No network access is used and nothing is uploaded. Your schedule never leaves your "
            "computer — which matters, because most owners will not permit a live schedule to be "
            "sent to a cloud service."),
           ("What you need",
            "Python and a P6 XER export. Setup instructions are included."),
         ]),

    dict(slug="turnaround-defects-guide", cat="free",
         name="14 Defects That Kill Turnarounds",
         tagline="The schedule failures that show up every time.",
         img=f"{IMG}/cards/digital4.jpg",
         price="Free", status="soon",
         short="What each defect looks like in P6, what it does to your critical path, and how to catch it before the unit comes down.",
         bullets=["What each defect looks like in P6", "What it does to the critical path",
                  "How to fix it before the outage", "Free PDF"],
         detail=[
           ("What it is",
            "A short guide to the fourteen schedule defects that appear on turnaround after "
            "turnaround, written from thirty-two years of finding them."),
           ("Who it is for",
            "Planners, schedulers and turnaround coordinators — and owner reps who have to review "
            "someone else's schedule and need to know what to look for."),
           ("What you get",
            "The guide as a PDF, delivered by email. No charge."),
           ("What you need",
            "Nothing."),
         ]),
]


# --------------------------------------------------------------------------
# TEMPLATES
# --------------------------------------------------------------------------

NAV = """  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="{root}index.html" aria-label="Shell Key Home">
        <img class="brand-logo" src="{root}assets/img/logo/ShellKeyWhiteTrace.png" alt="Shell Key" loading="eager" />
      </a>
      <nav class="nav">
        <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <ul class="nav-links" id="navLinks">
          <li><a class="nav-link" href="{root}index.html#home">Home</a></li>
          <li><a class="nav-link" href="{root}index.html#dashboards">Dashboards</a></li>
          <li><a class="nav-link" href="{root}index.html#applications">Applications</a></li>
          <li><a class="nav-link{store_on}" href="{root}store.html">Store</a></li>
          <li><a class="nav-link" href="{root}index.html#about">About</a></li>
          <li><a class="nav-link" href="{root}index.html#contact">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>
"""

FOOTER = """  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="muted">&copy; 2026 Shell Key. All rights reserved. Lafayette, Louisiana.</div>
      <div class="muted footer-links">
        <a href="{root}privacy.html">Privacy</a> &middot;
        <a href="{root}terms.html">Terms</a> &middot;
        <a href="mailto:support@shellkey.company">support@shellkey.company</a> &middot;
        <a href="tel:+13372548321">+1 (337) 254-8321</a>
      </div>
    </div>
  </footer>
"""

# Analytics. Cloudflare Web Analytics is free and needs no cookie banner: Cloudflare
# dashboard -> Analytics & Logs -> Web Analytics -> Add a site -> copy the token.
# GA4 is optional; leave the ID as-is and the tag is skipped.
CF_BEACON_TOKEN = "YOUR_CLOUDFLARE_WEB_ANALYTICS_TOKEN"
GA4_ID = "G-XXXXXXXXXX"

def analytics():
    out = ""
    if not CF_BEACON_TOKEN.startswith("YOUR_"):
        out += (f'  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" '
                f'data-cf-beacon=\'{{"token": "{CF_BEACON_TOKEN}"}}\'></script>\n')
    if not GA4_ID.startswith("G-X"):
        out += (f'  <script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>\n'
                f'  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}'
                f'gtag("js",new Date());gtag("config","{GA4_ID}");</script>\n')
    return out

VIEWER = """  <div class="viewer" id="viewer" aria-hidden="true">
    <div class="viewer-backdrop" id="viewerBackdrop"></div>
    <div class="viewer-ui">
      <button class="viewer-btn" id="viewerClose" aria-label="Close image">&#10005;</button>
      <a class="viewer-btn" id="viewerOpenNew" href="#" target="_blank" rel="noopener" aria-label="Open image in new tab">&#8599;</a>
      <button class="viewer-btn" id="viewerReset" aria-label="Reset zoom">&#8635;</button>
    </div>
    <div class="viewer-stage" id="viewerStage">
      <img id="viewerImg" alt="Expanded view" />
    </div>
  </div>
"""

SCRIPT = """  <script src="{root}assets/site.js?v={build}" defer></script>
"""


SITE = "https://shellkey.company"
BUILD = time.strftime("%Y%m%d%H%M")   # cache-buster for css/js — changes every build

def seo(title, desc, root="", path="", image="assets/img/social/og-image.jpg"):
    """Favicons, canonical, Open Graph, Twitter card and Organization schema."""
    url = SITE + "/" + path.lstrip("/")
    return f"""  <link rel="canonical" href="{url}" />
  <link rel="icon" href="{root}favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="{root}assets/img/logo/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="48x48" href="{root}assets/img/logo/favicon-48.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="{root}assets/img/logo/favicon-96.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="{root}assets/img/logo/favicon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="{root}assets/img/logo/favicon-512.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="{root}assets/img/logo/apple-touch-icon.png" />
  <link rel="manifest" href="{root}site.webmanifest" />
  <meta name="application-name" content="Shell Key" />
  <meta name="apple-mobile-web-app-title" content="Shell Key" />
  <meta name="theme-color" content="#07142a" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Shell Key" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}/{image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{SITE}/{image}" />
"""


SITE_SCHEMA = """  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebSite","name":"Shell Key","alternateName":"ShellKey",
   "url":"https://shellkey.company/","publisher":{"@id":"https://shellkey.company/#organization"}}
  </script>
"""

ORG_SCHEMA = """  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://shellkey.company/#organization",
    "name": "Shell Key",
    "alternateName": ["Shell Key LLC", "ShellKey"],
    "url": "https://shellkey.company",
    "logo": {
      "@type": "ImageObject",
      "url": "https://shellkey.company/assets/img/logo/shellkey-mark-square.png",
      "width": 512,
      "height": 512
    },
    "image": "https://shellkey.company/assets/img/social/og-image.jpg",
    "description": "Digital project controls for industrial execution \\u2014 Power BI dashboards, mobile and desktop field applications, business portals, training and SOPs for turnarounds, refineries, LNG and petrochemical projects.",
    "email": "support@shellkey.company",
    "telephone": "+1-337-254-8321",
    "founder": {"@type": "Person", "name": "Kirby C. Billiot"},
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Lafayette",
      "addressRegion": "LA",
      "addressCountry": "US"
    },
    "areaServed": "US",
    "knowsAbout": [
      "Project Controls", "Primavera P6", "Power BI", "Turnaround Planning",
      "Refinery Turnarounds", "LNG Construction", "Workpack Management",
      "API 510 Inspection", "Schedule Analysis", "Industrial Dashboards"
    ],
    "sameAs": [
      "https://www.linkedin.com/company/shell-key/",
      "https://www.facebook.com/ShellKeyCompany",
      "https://www.linkedin.com/in/kirbycbilliot/"
    ]
  }
  </script>
"""


def head(title, desc, root="", path="", schema=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <link rel="stylesheet" href="{root}assets/styles.css?v={BUILD}" />
  <link rel="stylesheet" href="{root}assets/store.css?v={BUILD}" />
{seo(title, desc, root, path)}{SITE_SCHEMA}{schema}{analytics()}</head>
<body>
"""


def status_badge(p):
    if p["status"] == "available":
        return '<span class="tag tag-live">Available Now</span>'
    if p["status"] == "quote":
        return '<span class="tag tag-quote">By Quote</span>'
    return '<span class="tag tag-soon">Coming Soon</span>'


def price_block(p):
    price = p.get("price", "")
    was = p.get("was")
    if not price:
        return '<div class="price-row"><span class="price-note">See price at checkout</span></div>'
    was_html = f'<span class="price-was">{was}</span>' if was else ""
    note = ""
    if p.get("price_note"):
        note = f'<span class="price-note">{p["price_note"]}</span>'
    elif p["status"] == "soon" and price not in ("Free",):
        note = '<span class="price-note">planned price</span>'
    elif p["status"] == "quote":
        note = '<span class="price-note">scope dependent</span>'
    return f'<div class="price-row"><span class="price">{price}</span>{was_html}{note}</div>'


def live_link(link):
    """A PayPal link is usable only once the placeholder has been replaced."""
    return bool(link) and not link.startswith("PAYPAL_LINK_") and link != "#"


def action_button(p, root=""):
    slug = p["slug"]
    if p["status"] == "available" and live_link(p.get("paypal")):
        label = "Subscribe (PayPal)" if p.get("subscribe") else "Buy Now (PayPal)"
        btn = (f'<a class="btn btn-primary btn-block" href="{p["paypal"]}" '
               f'data-track="checkout" data-item="{slug}">{label}</a>')
        alt = p.get("paypal_alt")
        if alt and live_link(alt[1]):
            btn += (f'<a class="btn btn-ghost btn-block" href="{alt[1]}" '
                    f'data-track="checkout" data-item="{slug}-alt">{alt[0]}</a>')
        return btn
    if p["status"] == "quote":
        label = "Request a Quote"
    elif p["status"] == "available":
        label = "Order by Request"      # real product, PayPal link not pasted yet
    else:
        label = "Request This"
    return (f'<a class="btn btn-primary btn-block" '
            f'href="{root}request.html?item={slug}">{label}</a>')


def demo_link(p, root=""):
    """'Try the free demo' button — opens the demo inside the Shell Key demo frame.
    Cards without a demo get an empty slot of the same height so every card's
    Details / Buy buttons sit on the same line."""
    if not p.get("demo"):
        return ""
    return (f'<a class="btn btn-demo btn-block" href="{root}demo.html?item={p["slug"]}" '
            f'data-track="demo" data-item="{p["slug"]}">Try the free demo</a>')


def card(p):
    feature = " card-feature" if (p.get("feature") or p.get("badge")) else ""
    label = "Best Value" if p.get("feature") else p.get("badge", "")
    badge = f'<span class="ribbon">{label}</span>' if label else ""
    bullets = "".join(f"<li>{b}</li>" for b in p["bullets"][:3])
    media_cls = "card-media cover-media" if p.get("cover") else "card-media"
    return f"""          <article class="card product-card{feature}" data-cat="{p['cat']}" data-slug="{p['slug']}">
            {badge}
            <a class="{media_cls}" href="products/{p['slug']}.html">
              <img src="{p['img']}" alt="{re.sub('&amp;','and',p['name'])}" loading="lazy" />
            </a>
            <div class="card-body">
              <div class="card-tags">{status_badge(p)}</div>
              <h3><a class="plain" href="products/{p['slug']}.html">{p['name']}</a></h3>
              <p class="card-short" title="{html.escape(re.sub('<[^>]+>','',p['short']))}">{p['short']}</p>
              <ul class="bullets">{bullets}</ul>
              {price_block(p)}
              <div class="proof" data-proof="{p['slug']}" data-ref="{html.escape(p.get('paypal','') or '')}"></div>
              <div class="card-actions">
                {demo_link(p) or f'<a class="btn btn-ghost btn-block" href="products/{p["slug"]}.html">Details</a>'}
                {action_button(p)}
              </div>
            </div>
          </article>
"""


def build_store():
    parts = [head("Store | Shell Key — Dashboards, Apps, Training &amp; Tools",
                  "Power BI wall charts, field applications, portals, training and SOPs for "
                  "industrial project execution. Built by a project controls specialist with 32 "
                  "years on refinery, LNG and petrochemical projects.",
                  path="store.html", schema=ORG_SCHEMA)]
    parts.append(NAV.format(root="", store_on=" active"))
    parts.append("""  <main>
    <section class="hero store-hero">
      <div class="container">
        <div class="hero-card">
          <div class="hero-banner">
            <p class="eyebrow">Store</p>
            <h1>Track the work. Prove the progress.</h1>
            <p>
              Wall charts, field apps, portals and training for industrial project execution —
              built on live turnarounds, not tutorials. Download a guide today, or have a full
              system built to your data.
            </p>
            <div class="about-grid credline">
              <div class="pill">32 Years Project Controls</div>
              <div class="pill">Projects $75M &ndash; $3.8B</div>
              <div class="pill">API-510 / 570 &middot; NDE II</div>
              <div class="pill">Power Apps Black Belt</div>
              <div class="pill">P6 &middot; Power BI &middot; SAP</div>
            </div>
            <div class="hero-cta">
              <a class="btn btn-primary" href="#software">Software Subscriptions</a>
              <a class="btn btn-ghost" href="#wallcharts">Wall Charts</a>
              <a class="btn btn-ghost" href="#guides">Guides — Available Now</a>
            </div>
          </div>
        </div>

        <div class="notice">
          <strong>Most items below are in production.</strong> The guides are available for instant
          download today. Everything marked <em>Coming Soon</em> can be prioritised &mdash; if you
          need one now, request it and we can usually have it ready in a few days.
        </div>
      </div>
    </section>
""")

    for i, (cid, cname, cdesc) in enumerate(CATEGORIES):
        items = [p for p in PRODUCTS if p["cat"] == cid]
        if not items:
            continue
        alt = " section-alt" if i % 2 == 1 else ""
        parts.append(f"""    <section id="{cid}" class="section{alt}">
      <div class="container">
        <div class="section-head">
          <h2>{cname}</h2>
          <p>{cdesc}</p>
        </div>
        <div class="grid">
""")
        for p in items:
            parts.append(card(p))
        parts.append("        </div>\n      </div>\n    </section>\n")

    parts.append("""  </main>
""")
    parts.append(FOOTER.format(root=""))
    parts.append(SCRIPT.format(root="", build=BUILD))
    parts.append("</body>\n</html>\n")
    return "".join(parts)


def build_product(p):
    root = "../"
    title = f"{p['name']} | Shell Key"
    parts = [head(title, p["short"], root, path=f"products/{p['slug']}.html")]
    parts.append(NAV.format(root=root, store_on=" active"))

    detail_html = "".join(
        f'<div class="detail-block"><h3>{h}</h3><p>{b}</p></div>' for h, b in p["detail"])

    gallery_html = ""
    if p.get("gallery"):
        shots = "".join(
            f'<figure class="shot"><img class="zoomable" src="{root}{src}" '
            f'data-full="{root}{src}" alt="{cap}" loading="lazy" />'
            f'<figcaption>{cap}</figcaption></figure>'
            for src, cap in p["gallery"])
        gallery_html = (
            '<section class="section gallery-sec"><div class="section-head">'
            f'<h2>All {len(p["gallery"])} views</h2>'
            '<p>Every view below is part of the same report and the same file. '
            'Click any image to see it full size.</p></div>'
            f'<div class="shot-grid">{shots}</div></section>')
    bullets = "".join(f"<li>{b}</li>" for b in p["bullets"])

    if p["status"] == "available" and p.get("subscribe"):
        cta_note = ("Secure checkout by PayPal — cards accepted without a PayPal account. "
                    "Your access details are emailed the same business day.")
    elif p["status"] == "available" and not live_link(p.get("paypal")):
        cta_note = ("Online checkout for this item is being connected. Send a request and "
                    "you will get a PayPal invoice the same business day.")
    elif p["status"] == "available":
        cta_note = ("Delivered by email immediately after payment. No account needed.")
    elif p["status"] == "quote":
        cta_note = ("Tell us about your project and you will get a scoped, fixed price back — "
                    "usually within two business days.")
    else:
        cta_note = ("This one is in production. If you need it now, request it — priority builds "
                    "can usually be ready within a few days.")

    parts.append(f"""  <main>
    <div class="container">
      <nav class="crumbs"><a href="{root}store.html">Store</a> <span>/</span> {p['name']}</nav>

      <article class="product-detail">
        <div class="pd-media card{" pd-cover" if p.get("cover") else ""}">
          <img class="zoomable" src="{root}{p['img']}" data-full="{root}{p['img']}"
               alt="{re.sub('&amp;','and',p['name'])}" loading="eager" />
          <p class="muted tiny zoomhint">Click the image to view full size</p>
        </div>

        <div class="pd-info card">
          <div class="card-body">
            <div class="card-tags">{status_badge(p)}</div>
            <h1>{p['name']}</h1>
            <p class="tagline">{p['tagline']}</p>
            <p>{p['short']}</p>
            <ul class="bullets">{bullets}</ul>
            {price_block(p)}
            <div class="proof" data-proof="{p['slug']}" data-ref="{html.escape(p.get('paypal','') or '')}"></div>
            {demo_link(p, root)}
            {action_button(p, root)}
            <p class="muted tiny cta-note">{cta_note}</p>
          </div>
        </div>
      </article>

      <section class="section pd-detail">
        <div class="detail-grid">{detail_html}</div>
      </section>

      {gallery_html}

      <section class="section">
        <div class="card">
          <div class="card-body pd-foot">
            <h3>Questions before you commit?</h3>
            <p class="muted">Call <a href="tel:+13372548321">+1 (337) 254-8321</a> or email
              <a href="mailto:support@shellkey.company">support@shellkey.company</a>.
              A real person, same day.</p>
            <div class="about-actions">
              <a class="btn btn-ghost" href="{root}store.html">Back to Store</a>
              <a class="btn btn-primary" href="{root}request.html?item={p['slug']}">Request Information</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
""")
    parts.append(FOOTER.format(root=root))
    parts.append(VIEWER)
    parts.append(SCRIPT.format(root=root, build=BUILD))
    parts.append("</body>\n</html>\n")
    return "".join(parts)


def build_request():
    options = []
    for cid, cname, _ in CATEGORIES:
        items = [p for p in PRODUCTS if p["cat"] == cid]
        if not items:
            continue
        clean = re.sub("&amp;", "and", cname)
        options.append(f'<optgroup label="{clean}">')
        for p in items:
            nm = re.sub("&amp;", "and", p["name"])
            options.append(f'<option value="{p["slug"]}">{nm}</option>')
        options.append("</optgroup>")
    options.append('<optgroup label="Other"><option value="other">Something else — described below</option></optgroup>')
    opts = "\n            ".join(options)

    parts = [head("Request Information | Shell Key",
                  "Request a product, a quote, or priority build. Tell us what you need and "
                  "we will come back within two business days.", path="request.html")]
    parts.append(NAV.format(root="", store_on=""))
    parts.append(f"""  <main>
    <section class="section">
      <div class="container">
        <div class="section-head">
          <h2>Request Information</h2>
          <p>Tell us what you need. If it is not built yet and you need it now, say so &mdash;
             priority builds can usually be ready within a few days.</p>
        </div>

        <div class="request-grid">
          <div class="card">
            <div class="card-body">
              <h3>What happens next</h3>
              <div class="about-points">
                <div class="about-point"><span class="dot"></span><div>
                  <strong>We read it same day</strong>
                  <div class="muted">Business hours, Monday to Friday.</div></div></div>
                <div class="about-point"><span class="dot"></span><div>
                  <strong>You get a real answer</strong>
                  <div class="muted">A price and a date, or an honest no &mdash; not a brochure.</div></div></div>
                <div class="about-point"><span class="dot"></span><div>
                  <strong>Need it fast?</strong>
                  <div class="muted">Tick priority below. Most items can be ready in a few days.</div></div></div>
              </div>
              <hr class="rule" />
              <p class="muted"><strong>Prefer to talk?</strong><br />
                <a href="tel:+13372548321">+1 (337) 254-8321</a><br />
                <a href="mailto:support@shellkey.company">support@shellkey.company</a></p>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <h3>Your details</h3>
              <form id="requestForm" class="form">
                <label><span>What do you need? *</span>
                  <select id="rType" required>
                    <option value="Information">Information / a question</option>
                    <option value="Purchase">Purchase this product</option>
                    <option value="Customization">Customize it for my company</option>
                    <option value="Quote">A quote for a custom build</option>
                    <option value="Priority build">Priority build — I need it fast</option>
                  </select>
                </label>
                <label><span>Which product? *</span>
                  <select id="rItem" required>
                    <option value="">Select an item&hellip;</option>
                    {opts}
                  </select>
                </label>

                <div class="field-2">
                  <label><span>Name *</span>
                    <input id="rName" type="text" required autocomplete="name" placeholder="Your full name" /></label>
                  <label><span>Company *</span>
                    <input id="rCompany" type="text" required autocomplete="organization" placeholder="Company name" /></label>
                </div>

                <div class="field-2">
                  <label><span>Email *</span>
                    <input id="rEmail" type="email" required autocomplete="email" placeholder="you@company.com" /></label>
                  <label><span>Phone</span>
                    <input id="rPhone" type="tel" autocomplete="tel" placeholder="Optional" /></label>
                </div>

                <label><span>Address *</span>
                  <input id="rAddress" type="text" required autocomplete="street-address" placeholder="Street address" /></label>

                <div class="field-2">
                  <label><span>City / State *</span>
                    <input id="rCity" type="text" required placeholder="City, State" /></label>
                  <label><span>Zip / Postal code</span>
                    <input id="rZip" type="text" autocomplete="postal-code" placeholder="Optional" /></label>
                </div>

                <label><span>What are you looking for? *</span>
                  <textarea id="rNeed" rows="5" required
                    placeholder="What you need it to do, how many users, what systems it has to connect to, and anything else that matters."></textarea></label>

                <label><span>When do you need it?</span>
                  <select id="rWhen">
                    <option value="Just exploring">Just exploring</option>
                    <option value="Within a month">Within a month</option>
                    <option value="Within two weeks">Within two weeks</option>
                    <option value="As soon as possible">As soon as possible</option>
                  </select></label>

                <label class="check">
                  <input id="rPriority" type="checkbox" />
                  <span class="checktext">I need this made a priority &mdash; I understand you may be able
                    to have it ready within a few days.</span>
                </label>

                <button class="btn btn-primary btn-block" type="submit">Send Request</button>
                <div class="form-ok" id="formOk">
                  <strong>Got it &mdash; your request is in.</strong> You will hear back the same
                  business day. Need it faster? Call <a href="tel:+13372548321">+1 (337) 254-8321</a>.
                </div>
                <div class="form-err" id="formErr">
                  <strong>That did not go through.</strong> Please email
                  <a href="mailto:support@shellkey.company">support@shellkey.company</a>
                  or call <a href="tel:+13372548321">+1 (337) 254-8321</a>.
                </div>
                <p class="muted tiny">
                  Sent straight to Shell Key. See the <a href="privacy.html">privacy policy</a>
                  for how your details are handled.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
""")
    parts.append(FOOTER.format(root=""))
    parts.append(SCRIPT.format(root="", build=BUILD))
    parts.append("</body>\n</html>\n")
    return "".join(parts)


def build_legal(title, path, body):
    parts = [head(f"{title} | Shell Key",
                  f"Shell Key {title.lower()} for shellkey.company and Shell Key software subscriptions.",
                  path=path)]
    parts.append(NAV.format(root="", store_on=""))
    parts.append(f"""  <main>
    <section class="section">
      <div class="container legal">
        <div class="section-head"><h1>{title}</h1><p class="muted">Last updated September 2026</p></div>
        <div class="card"><div class="card-body legal-body">
{body}
        </div></div>
      </div>
    </section>
  </main>
""")
    parts.append(FOOTER.format(root=""))
    parts.append(SCRIPT.format(root="", build=BUILD))
    parts.append("</body>\n</html>\n")
    return "".join(parts)


PRIVACY = """
<h3>Who we are</h3>
<p>Shell Key ("we", "us") is a project-controls software and services business based in Lafayette, Louisiana. Contact: support@shellkey.company, +1 (337) 254-8321.</p>
<h3>What we collect</h3>
<p><strong>Information you give us.</strong> When you submit a form (request, quote, contact, or download), we store what you enter: name, company, email, phone, address, and your message.</p>
<p><strong>Site usage.</strong> We record page views on this site — the page, the referring site, the time, an anonymous browser identifier, and the country and device type reported by your browser. We use Cloudflare Web Analytics, which does not use cookies or track you across other sites. If you later submit a form, we may associate your earlier visits on this site with your request so we can respond with the right product.</p>
<p><strong>Purchases.</strong> Payments are processed by PayPal. We never see or store your card number. PayPal sends us your name, email, the item purchased, and the transaction or subscription reference so we can deliver what you bought and handle support and cancellations.</p>
<h3>How we use it</h3>
<p>To answer your request, deliver and support the products you buy, bill subscriptions, improve this site, and — if you have asked for it or are a customer — send occasional product updates. Every marketing email includes an unsubscribe link, and a reply saying "no thanks" is honored within ten days.</p>
<h3>Who we share it with</h3>
<p>Service providers only, and only to run the business: Cloudflare (hosting, analytics, database), PayPal (payments), Google (email). We do not sell your information.</p>
<h3>How long we keep it</h3>
<p>Form submissions and customer records are kept while you are a customer or prospect and for up to three years after last contact. Page-view records are kept for twelve months.</p>
<h3>Your choices</h3>
<p>Email support@shellkey.company to see, correct, or delete what we hold about you, or to opt out of marketing. We respond within ten business days.</p>
<h3>Changes</h3>
<p>If this policy changes materially, the date above changes and customers are notified by email.</p>
"""

TERMS = """
<h3>Purchases and delivery</h3>
<p>Prices are shown in U.S. dollars. Payments are processed by PayPal. Digital guides and files are delivered by email after payment. Software subscriptions (Bid Board, Shell Key Inspection System, training) are activated the same business day; access details are sent to the email used at checkout.</p>
<h3>Subscriptions and cancellation</h3>
<p>Bid Board bills $75 for the first month and $295 per month thereafter until cancelled. The introductory month is available once per company. The Inspection System bills $2,000 per year. To cancel, email support@shellkey.company from the account email; you will receive a confirmation, access ends at the close of the current billing period, and no further charges are made. Fees already billed are not refunded.</p>
<h3>Website builds</h3>
<p>The AI Website Studio start fee of $50 is non-refundable and is credited toward the $500 purchase price when you approve the site. If you do not approve a site, nothing further is owed.</p>
<h3>Custom work and quotes</h3>
<p>Custom dashboards, applications and portals are delivered under a written scope with a fixed price and date, agreed by email before work starts. Changes outside the scope are quoted separately.</p>
<h3>Licenses</h3>
<p>Guides, Power BI files and training content are licensed to the purchaser for internal business use. They may not be resold or redistributed. Software subscriptions are licensed to the subscribing company for its employees and contractors.</p>
<h3>Refunds</h3>
<p>Digital downloads are not refundable once delivered. If a file is defective, email support within seven days and it will be corrected or replaced. Subscriptions may be cancelled at any time as described above.</p>
<h3>Support</h3>
<p>Email support@shellkey.company or call +1 (337) 254-8321, Monday to Friday, 8 a.m. to 5 p.m. Central.</p>
<h3>Liability</h3>
<p>Shell Key products support your project decisions; they do not make them. Shell Key is not liable for indirect or consequential losses arising from use of its products, and its total liability for any product is limited to the amount paid for it.</p>
<h3>Governing law</h3>
<p>These terms are governed by the laws of the State of Louisiana. Questions: support@shellkey.company.</p>
"""


def build_demo():
    """demo.html — the frame every free demo opens in. Product data is embedded as JSON."""
    import json
    items = {p["slug"]: {"name": re.sub("&amp;", "&", p["name"]), "demo": p["demo"],
                         "price": p.get("price", ""), "note": p.get("price_note", ""),
                         "buy": p["paypal"] if (p["status"] == "available" and live_link(p.get("paypal"))) else "",
                         "subscribe": bool(p.get("subscribe"))}
             for p in PRODUCTS if p.get("demo")}
    parts = [head("Free Demo | Shell Key", "Try Shell Key software free, then buy or request a customized version.",
                  path="demo.html")]
    parts.append("""  <main class="demo-page">
    <div class="demo-bar">
      <a class="brand" href="index.html"><img class="brand-logo" src="assets/img/logo/ShellKeyWhiteTrace.png" alt="Shell Key" /></a>
      <div class="demo-title"><span class="tag tag-live">Free demo</span> <strong id="dName">Shell Key</strong>
        <span class="muted" id="dPrice"></span></div>
      <div class="demo-actions">
        <a class="btn btn-primary" id="dBuy" href="#">Buy now</a>
        <a class="btn btn-ghost" id="dReq" href="#">Request purchase</a>
        <a class="btn btn-ghost" id="dCust" href="#">Request customization</a>
        <a class="btn btn-ghost" id="dOpen" href="#" target="_blank" rel="noopener" title="Open the demo in its own tab">&#8599;</a>
      </div>
    </div>
    <div class="demo-gate" id="gate">
      <div class="card"><div class="card-body">
        <h2>Start the free demo</h2>
        <p class="muted">Tell us who you are and the demo opens right here. No card, no install. We'll follow up once to see if it fits &mdash; that's it.</p>
        <form id="gateForm" class="form">
          <div class="field-2">
            <label><span>Name *</span><input id="gName" type="text" required autocomplete="name" placeholder="Your name" /></label>
            <label><span>Company</span><input id="gCompany" type="text" autocomplete="organization" placeholder="Company" /></label>
          </div>
          <div class="field-2">
            <label><span>Work email *</span><input id="gEmail" type="email" required autocomplete="email" placeholder="you@company.com" /></label>
            <label><span>Phone</span><input id="gPhone" type="tel" autocomplete="tel" placeholder="Optional" /></label>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Open the demo</button>
          <div class="form-err" id="gateErr"><strong>That did not go through.</strong> Refresh and try again, or call <a href="tel:+13372548321">+1 (337) 254-8321</a>.</div>
          <p class="muted tiny">By continuing you agree to the <a href="terms.html">terms</a> and <a href="privacy.html">privacy policy</a>.</p>
        </form>
      </div></div>
    </div>
    <iframe id="demoFrame" class="demo-frame" title="Product demo" hidden></iframe>
    <div class="demo-missing" id="missing" hidden>
      <div class="card"><div class="card-body">
        <h2>That demo isn't available yet</h2>
        <p class="muted">Pick a product from the <a href="store.html">store</a>, or <a href="request.html">request a walkthrough</a>.</p>
      </div></div>
    </div>
  </main>
""")
    parts.append("  <script>window.SK_DEMOS = " + json.dumps(items) + ";</script>\n")
    parts.append(SCRIPT.format(root="", build=BUILD))
    parts.append("</body>\n</html>\n")
    return "".join(parts)


def build_sitemap():
    urls = ["", "store.html", "request.html", "demo.html", "privacy.html", "terms.html"] + \
           [f"products/{p['slug']}.html" for p in PRODUCTS]
    rows = "".join(
        f"  <url><loc>{SITE}/{u}</loc>"
        f"<changefreq>{'weekly' if u in ('', 'store.html') else 'monthly'}</changefreq>"
        f"<priority>{'1.0' if u == '' else '0.9' if u == 'store.html' else '0.7'}</priority>"
        f"</url>\n" for u in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{rows}</urlset>\n")


def build_robots():
    return ("User-agent: *\n"
            "Allow: /\n"
            "Disallow: /crm.html\n"
            "Disallow: /api/\n\n"
            f"Sitemap: {SITE}/sitemap.xml\n")


def stamp_index():
    """Give index.html the same cache-busting version on its css/js links."""
    with open("index.html", encoding="utf-8") as f:
        html_ = f.read()
    html_ = re.sub(r'(assets/(?:styles|store)\.css)(\?v=\d+)?', r'\1?v=' + BUILD, html_)
    html_ = re.sub(r'(assets/site\.js)(\?v=\d+)?', r'\1?v=' + BUILD, html_)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_)
    print("stamped index.html with build " + BUILD)


def main():
    os.makedirs(OUT_PRODUCTS, exist_ok=True)
    stamp_index()

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(build_sitemap())
    with open("robots.txt", "w", encoding="utf-8") as f:
        f.write(build_robots())
    print("wrote sitemap.xml + robots.txt")

    with open("store.html", "w", encoding="utf-8") as f:
        f.write(build_store())
    print("wrote store.html")

    with open("privacy.html", "w", encoding="utf-8") as f:
        f.write(build_legal("Privacy Policy", "privacy.html", PRIVACY))
    with open("terms.html", "w", encoding="utf-8") as f:
        f.write(build_legal("Terms of Service", "terms.html", TERMS))
    print("wrote privacy.html + terms.html")

    with open("demo.html", "w", encoding="utf-8") as f:
        f.write(build_demo())
    print("wrote demo.html")

    with open("request.html", "w", encoding="utf-8") as f:
        f.write(build_request())
    print("wrote request.html")

    wanted = set()
    for p in PRODUCTS:
        path = os.path.join(OUT_PRODUCTS, f"{p['slug']}.html")
        wanted.add(os.path.basename(path))
        with open(path, "w", encoding="utf-8") as f:
            f.write(build_product(p))
    print(f"wrote {len(PRODUCTS)} pages into {OUT_PRODUCTS}/")

    # Delete pages for products that no longer exist, or renaming/merging a
    # product silently leaves an orphan page live on the site forever.
    stale = [f for f in os.listdir(OUT_PRODUCTS)
             if f.endswith(".html") and f not in wanted]
    for f in stale:
        os.remove(os.path.join(OUT_PRODUCTS, f))
    if stale:
        print(f"removed {len(stale)} stale page(s): {', '.join(sorted(stale))}")

    counts = {}
    for p in PRODUCTS:
        counts[p["status"]] = counts.get(p["status"], 0) + 1
    print("  by status:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
