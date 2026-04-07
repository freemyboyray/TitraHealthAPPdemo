#!/usr/bin/env python3
"""Generate TitraHealth comprehensive product summary PDF."""

from fpdf import FPDF
import os

class TitraPDF(FPDF):
    ORANGE = (255, 116, 42)
    DARK_BG = (17, 17, 17)
    WHITE = (255, 255, 255)
    LIGHT_GRAY = (200, 200, 200)
    MID_GRAY = (140, 140, 140)
    DARK_GRAY = (60, 60, 60)
    GREEN = (39, 174, 96)
    YELLOW = (243, 156, 18)
    RED = (231, 76, 60)
    BLUE = (90, 200, 250)

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*self.MID_GRAY)
        self.cell(0, 8, "TitraHealth  |  Product Summary  |  Confidential", align="C")
        self.ln(4)
        self.set_draw_color(*self.ORANGE)
        self.set_line_width(0.3)
        self.line(15, self.get_y(), self.w - 15, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*self.MID_GRAY)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def cover_page(self):
        self.add_page()
        self.ln(60)
        self.set_font("Helvetica", "B", 36)
        self.set_text_color(*self.ORANGE)
        self.cell(0, 15, "TitraHealth", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        self.set_font("Helvetica", "", 16)
        self.set_text_color(*self.DARK_GRAY)
        self.cell(0, 10, "GLP-1 Companion App", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_draw_color(*self.ORANGE)
        self.set_line_width(1)
        x_center = self.w / 2
        self.line(x_center - 30, self.get_y(), x_center + 30, self.get_y())
        self.ln(12)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, "Comprehensive Product Summary", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*self.MID_GRAY)
        self.cell(0, 8, "Architecture, Features, Scoring, and Roadmap", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(40)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*self.MID_GRAY)
        self.cell(0, 7, "Version: Rev 14  |  March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 7, "Prepared by: Team Titra Health", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 7, "Confidential", align="C", new_x="LMARGIN", new_y="NEXT")

    def section_title(self, number, title):
        self.ln(6)
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*self.ORANGE)
        self.cell(0, 12, f"{number}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*self.ORANGE)
        self.set_line_width(0.5)
        self.line(15, self.get_y(), self.w - 15, self.get_y())
        self.ln(6)

    def sub_title(self, title):
        self.ln(3)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(50, 50, 50)
        self.cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def sub_sub_title(self, title):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(80, 80, 80)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text, indent=20):
        x = self.get_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*self.ORANGE)
        self.cell(indent, 5.5, "-")
        self.set_text_color(60, 60, 60)
        self.multi_cell(self.w - 2 * 15 - indent, 5.5, text)
        self.ln(1)

    def bold_bullet(self, bold_part, rest, indent=20):
        self.set_text_color(*self.ORANGE)
        self.cell(indent, 5.5, "-")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(60, 60, 60)
        w_bold = self.get_string_width(bold_part) + 1
        self.cell(w_bold, 5.5, bold_part)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5.5, rest)
        self.ln(1)

    def info_box(self, title, text):
        self.ln(2)
        self.set_fill_color(255, 245, 238)
        self.set_draw_color(*self.ORANGE)
        x = 15
        w = self.w - 30
        # estimate height
        self.set_font("Helvetica", "", 10)
        lines = len(text) / 90 + 2
        h = max(20, lines * 5.5 + 16)
        y_start = self.get_y()
        if y_start + h > self.h - 25:
            self.add_page()
            y_start = self.get_y()
        self.rect(x, y_start, w, h, style="DF")
        self.set_xy(x + 5, y_start + 3)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*self.ORANGE)
        self.cell(0, 6, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(x + 5)
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(80, 80, 80)
        self.multi_cell(w - 10, 5, text)
        self.set_y(y_start + h + 4)

    def table(self, headers, rows, col_widths=None):
        self.ln(2)
        w_total = self.w - 30
        if col_widths is None:
            col_widths = [w_total / len(headers)] * len(headers)
        # Header
        self.set_fill_color(*self.ORANGE)
        self.set_text_color(*self.WHITE)
        self.set_font("Helvetica", "B", 9)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, h, border=1, fill=True, align="C")
        self.ln()
        # Rows
        self.set_font("Helvetica", "", 9)
        self.set_text_color(60, 60, 60)
        fill = False
        for row in rows:
            if self.get_y() > self.h - 30:
                self.add_page()
            if fill:
                self.set_fill_color(248, 248, 248)
            else:
                self.set_fill_color(255, 255, 255)
            max_h = 7
            for i, cell_text in enumerate(row):
                lines = max(1, len(str(cell_text)) / (col_widths[i] / 2.2) )
                max_h = max(max_h, int(lines * 5.5 + 2))
            for i, cell_text in enumerate(row):
                self.cell(col_widths[i], 7, str(cell_text), border=1, fill=True)
            self.ln()
            fill = not fill
        self.ln(3)

    def toc_page(self):
        self.add_page()
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(*self.ORANGE)
        self.cell(0, 12, "Table of Contents", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)
        toc_items = [
            ("1", "What Is TitraHealth?", "The problem, the product, and what makes it different"),
            ("2", "Supported Medications", "14 brands, 6 drug classes, daily and weekly dosing"),
            ("3", "Patient Onboarding", "14-screen wizard that builds a personalized clinical profile"),
            ("4", "Personalized Targets Engine", "How protein, calories, macros, and activity targets are computed"),
            ("5", "Side-Effect Rules Engine", "13 condition-specific adjustment rules with conflict resolution"),
            ("6", "The Scoring System", "Two-ring model, phase-weighted scoring, 14-day rolling average"),
            ("7", "Pharmacokinetic (PK) Engine", "FDA-sourced Bateman equation modeling for all 6 drug classes"),
            ("8", "Escalation Phase Engine", "Clinical phase classification driving coaching and targets"),
            ("9", "Cycle Intelligence & Biometrics", "Appetite forecasting, HRV interpretation, plateau detection"),
            ("10", "Logging System", "5 food methods, injection, weight, activity, side effects, check-ins"),
            ("11", "AI Integration", "GPT-4o-mini for food parsing, vision, coaching, insights, and chat"),
            ("12", "Education Hub", "Myths, symptom decoder, deep dives, article library"),
            ("13", "Clinical Alerts", "Evidence-based flags for labs, lean mass, plateaus, dropout risk"),
            ("14", "Home Dashboard", "Score rings, focus cards, calendar, forecast strip"),
            ("15", "Settings & Integrations", "Profile editing, Apple Health, dark/light mode"),
            ("16", "Data Architecture", "Supabase backend, Zustand stores, AsyncStorage, state management"),
            ("17", "Future Vision & Roadmap", "CGM, telehealth, peer community, smartwatch, and more"),
        ]
        for num, title, desc in toc_items:
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(50, 50, 50)
            self.cell(12, 7, num + ".")
            self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
            self.set_x(27)
            self.set_font("Helvetica", "I", 9)
            self.set_text_color(*self.MID_GRAY)
            self.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")
            self.ln(3)


def build_pdf():
    pdf = TitraPDF()
    pdf.alias_nb_pages()

    # ── COVER ──
    pdf.cover_page()

    # ── TOC ──
    pdf.toc_page()

    # ══════════════════════════════════════════════
    # 1. WHAT IS TITRAHEALTH
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("1", "What Is TitraHealth?")

    pdf.body_text(
        "TitraHealth is a GLP-1 medication companion app for patients on drugs like Ozempic, Wegovy, "
        "Mounjaro, Zepbound, Trulicity, Saxenda, Rybelsus, and others. Built with React Native and Expo "
        "for iOS and Android, it ties together medication tracking, lifestyle optimization, and progress "
        "visibility into a single daily experience."
    )

    pdf.sub_title("The Problem")
    pdf.body_text(
        "GLP-1 receptor agonists are among the most effective weight-loss medications ever developed, but "
        "they work best when paired with specific behavioral changes: high protein intake to prevent muscle "
        "loss, adequate hydration to manage GI side effects, consistent injection timing, and progressive "
        "activity. Most patients receive a prescription and little else. Existing apps focus on one "
        "dimension (a food log OR an injection tracker OR a weight chart) but none connect all three "
        "through a unified, personalized scoring system."
    )

    pdf.sub_title("The Solution")
    pdf.body_text(
        "TitraHealth connects medication pharmacokinetics, daily behavior tracking, and clinical phase "
        "awareness into a closed feedback loop. The app knows what drug you're on, what dose, where you "
        "are in your titration, and what side effects you're experiencing. It uses this to generate "
        "personalized daily targets for protein, hydration, fiber, calories, and activity. It then scores "
        "your actual behavior against those targets using a phase-weighted, 14-day rolling average. The "
        "result is a single Lifestyle Effectiveness Score that reflects how well your daily habits are "
        "supporting your medication."
    )

    pdf.sub_title("Five Pillars of Value")
    pdf.bold_bullet("Medication Adherence: ", "Tracks injection history, dose level, next-dose countdowns, and injection site rotation.")
    pdf.bold_bullet("Lifestyle Optimization: ", "Monitors protein, hydration, fiber, steps, and sleep to maximize GLP-1 effectiveness.")
    pdf.bold_bullet("Progress Visibility: ", "Weight trend charts, BMI, goal progress, total weight lost, and projected goal date.")
    pdf.bold_bullet("Daily Guidance: ", "Contextual, personalized action cards driven by real user data and clinical phase.")
    pdf.bold_bullet("Education: ", "Structured content on GLP-1 usage, nutrition, side effects, and lifestyle best practices.")

    pdf.info_box("Key Differentiator",
        "Most GLP-1 apps do one thing. TitraHealth connects medication pharmacokinetics, behavioral "
        "tracking, and clinical phase awareness through the Lifestyle Effectiveness Score. This is the "
        "only app that adapts its targets and scoring weights based on which drug you're on, what dose, "
        "and where you are in your titration schedule."
    )

    # ══════════════════════════════════════════════
    # 2. SUPPORTED MEDICATIONS
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("2", "Supported Medications")

    pdf.body_text(
        "TitraHealth supports 14 medication brands across 6 active drug classes. Each brand maps to a "
        "specific pharmacokinetic profile, route of administration, dosing frequency, and titration schedule."
    )

    pdf.table(
        ["Drug Class", "Brands", "Half-Life", "Route", "Dosing"],
        [
            ["Semaglutide", "Ozempic, Wegovy", "~7 days", "SC Injection", "Weekly"],
            ["Tirzepatide", "Mounjaro, Zepbound", "~5 days", "SC Injection", "Weekly"],
            ["Dulaglutide", "Trulicity", "~5 days", "SC Injection", "Weekly"],
            ["Liraglutide", "Saxenda, Victoza", "13 hours", "SC Injection", "Daily"],
            ["Oral Semaglutide", "Rybelsus, Oral Wegovy", "~7 days", "Oral", "Daily"],
            ["Orforglipron", "Orforglipron", "~60 hours", "Oral", "Daily"],
        ],
        [32, 42, 25, 32, 25]
    )

    pdf.body_text(
        "Compounded variants (compounded semaglutide, compounded tirzepatide, compounded liraglutide) "
        "are also supported and inherit their parent drug's PK profile. An 'Other' option provides "
        "generic fallback behavior."
    )

    pdf.sub_title("Why This Matters")
    pdf.body_text(
        "Different drugs have fundamentally different behavior. Semaglutide has a 7-day half-life with "
        "peak plasma at ~56 hours post-injection. Liraglutide has a 13-hour half-life requiring daily "
        "dosing with no forgiveness for missed doses. Oral semaglutide has ~1% bioavailability without "
        "fasting. Tirzepatide is a dual GIP/GLP-1 agonist with stronger appetite suppression. Every "
        "downstream feature (targets, scoring, coaching, alerts) adapts based on which drug the patient is on."
    )

    # ══════════════════════════════════════════════
    # 3. PATIENT ONBOARDING
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("3", "Patient Onboarding")

    pdf.body_text(
        "When a patient opens TitraHealth for the first time, they walk through a 14-screen onboarding "
        "wizard. Every screen collects data that feeds into the personalized targets engine, the scoring "
        "system, or the escalation phase classifier. Nothing is decorative."
    )

    pdf.sub_title("Screen-by-Screen Breakdown")

    steps = [
        ("Screen 1: GLP-1 Journey Status",
         "The patient selects whether they are currently taking a GLP-1 ('active') or about to start "
         "('starting'). This controls downstream logic: starting patients get ramped-in protein targets "
         "over 3 weeks and see different scheduling options."),
        ("Screen 2: Medication Brand",
         "A scrollable list of 14 supported brands. The selection automatically maps to the active "
         "ingredient (glp1Type), route of administration (injection vs. oral), and default dosing "
         "frequency (daily vs. weekly). This is Signal 1 of the Two-Signal Personalization Model."),
        ("Screen 3: Current Dose",
         "Displays medication-specific dose chips (e.g., Zepbound shows 2.5, 5, 7.5, 10, 12.5, 15 mg). "
         "If the patient is 'active', they also select their starting dose. A titration summary banner "
         "shows the escalation schedule for their brand. The dose level drives the escalation phase "
         "engine and appetite suppression ceiling in the PK model."),
        ("Screen 4: Schedule & Timing",
         "Weekly injectables: select injection day + last injection date. Daily drugs: select dose time "
         "(HH:MM) + dose start date. Oral medications show a warning about empty stomach requirements. "
         "The last injection date seeds the PK curve and shot-phase calculation."),
        ("Screen 5: Biological Sex",
         "Male, Female, Other, or Prefer Not to Say. Used in the Mifflin-St Jeor BMR equation: +5 for "
         "male, -161 for female. This is the foundation of all calorie and macro target calculations."),
        ("Screen 6: Birthday",
         "Three wheel pickers (month, day, year). Age is derived and used for BMR calculation and "
         "fiber targets based on IOM age/sex guidelines."),
        ("Screen 7: Height & Weight",
         "Imperial/metric toggle with automatic bidirectional conversion. Height and weight feed "
         "directly into BMR, TDEE, and protein-per-kg calculations."),
        ("Screen 8: Apple Health Sync",
         "Optional HealthKit permission request for steps, HRV, resting heart rate, SpO2, and body "
         "mass. If granted, these metrics power the Recovery (outer) ring on the home screen."),
        ("Screen 9: Starting Weight & Date",
         "The weight when GLP-1 therapy began and the start date. This anchors the total weight lost "
         "metric and the program week counter that drives the escalation phase engine."),
        ("Screen 10: Goal Weight",
         "A horizontal ruler selector. The delta between current and goal weight determines projected "
         "timeline and enables goal progress tracking."),
        ("Screen 11: Weekly Loss Target",
         "Options from 0.2 to 3.0 lbs/week. This directly controls the calorie deficit (TDEE x loss "
         "rate) and protein scaling. Faster loss = higher protein to preserve lean mass."),
        ("Screen 12: Activity Level",
         "Sedentary, Light, Active, or Very Active. Maps to TDEE multipliers (1.2, 1.375, 1.55, "
         "1.725) and base step targets (8,000-9,000)."),
        ("Screen 13: Craving Days",
         "Multi-select day-of-week picker. Used for craving-day alerts and contextual coaching "
         "on high-risk days."),
        ("Screen 14: Side Effects",
         "Multi-select from: nausea, fatigue, hair loss, constipation, bloating, sulfur burps, and "
         "more. Each selected side effect triggers specific target adjustments via the 13-rule "
         "side-effect rules engine."),
    ]

    for title, desc in steps:
        pdf.sub_sub_title(title)
        pdf.body_text(desc)

    pdf.sub_title("What Happens on Completion")
    pdf.body_text(
        "When the patient taps the final Continue button, completeOnboarding() fires and performs "
        "four critical operations:"
    )
    pdf.bullet("Saves the full profile to AsyncStorage (offline-capable local cache)")
    pdf.bullet("Upserts to the Supabase profiles table (cloud persistence)")
    pdf.bullet("Runs computeBaseTargets(profile) using Mifflin-St Jeor and writes computed daily targets (calories, protein, fiber, steps, active calories) to the user_goals table")
    pdf.bullet("Clears the onboarding draft and routes to the main app")

    pdf.info_box("The Two-Signal Personalization Model",
        "Signal 1: Medication identity + titration position (brand, dose, starting dose, dose start "
        "date). This tells us the pharmacokinetic profile and where the patient is in their escalation. "
        "Signal 2: Escalation phase (initiation, titration, maintenance). This tells us the clinical "
        "priorities. Together, these two signals drive every downstream calculation: targets, scoring "
        "weights, coaching emphasis, AI context, and clinical alerts."
    )

    # ══════════════════════════════════════════════
    # 4. PERSONALIZED TARGETS ENGINE
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("4", "Personalized Targets Engine")

    pdf.body_text(
        "Every patient sees different daily targets. These are not generic recommendations. They are "
        "computed from the patient's specific body metrics, medication, dose, clinical phase, activity "
        "level, and active side effects."
    )

    pdf.sub_title("Step 1: Base Metabolic Rate (Mifflin-St Jeor)")
    pdf.body_text(
        "BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age + s, where s = +5 (male) or -161 "
        "(female). This is the most validated BMR equation for overweight/obese populations."
    )

    pdf.sub_title("Step 2: Total Daily Energy Expenditure")
    pdf.body_text(
        "TDEE = BMR x activity multiplier. Sedentary = 1.2, Light = 1.375, Active = 1.55, "
        "Very Active = 1.725."
    )

    pdf.sub_title("Step 3: Calorie Target")
    pdf.body_text(
        "Calorie target = TDEE x (1 - weekly_loss_rate). The faster the target weekly loss, the "
        "larger the deficit. Floor of 1,200 kcal/day to prevent metabolic suppression. In maintenance "
        "phase, a metabolic adaptation correction is applied: -10 kcal per kg of body weight lost."
    )

    pdf.sub_title("Step 4: Macro Targets")

    pdf.sub_sub_title("Protein")
    pdf.body_text(
        "Base: 1.6-2.0 g/kg lean body mass, scaled by weekly loss speed (faster loss = higher protein "
        "to preserve lean mass). Phase multipliers: initiation 1.0x, titration 1.15x, maintenance "
        "1.25x. Medication boosts: semaglutide >= 1.0 mg adds +10%, >= 1.7 mg adds +15%. Tirzepatide "
        ">= 7.5 mg adds +10%, >= 10 mg adds +15%. Hard cap: 2.0 g/kg/day at all phases."
    )
    pdf.body_text(
        "Clinical basis: Per 2025 joint guidance from ACLM, ASN, OMA, and TOS for GLP-1 patients, "
        "protein requirements increase during active weight loss to prevent sarcopenic outcomes."
    )

    pdf.sub_sub_title("Fat")
    pdf.body_text("28% of calorie target, per ACLM guidelines. Rounded to integer grams.")

    pdf.sub_sub_title("Carbohydrates")
    pdf.body_text("Remainder after protein and fat calories, with a 50g/day floor to prevent hypoglycemia risk.")

    pdf.sub_sub_title("Fiber")
    pdf.body_text("IOM age/sex guidelines: 21-38g range. Adjusted by side-effect rules (constipation increases, diarrhea decreases).")

    pdf.sub_sub_title("Water")
    pdf.body_text(
        "35 ml/kg body weight as baseline. Medication multipliers: semaglutide +10%, tirzepatide +10%, "
        "high doses (>= 5mg) +10-15%. Constipation adds another +10%. Cap: 4,000 ml/day."
    )

    pdf.sub_sub_title("Steps & Active Minutes")
    pdf.body_text(
        "8,000-9,000 steps base scaled by loss speed. Active minutes: 30-45 min base scaled by "
        "activity level. Maintenance phase adds a 10% step boost to counter reduced caloric expenditure."
    )

    pdf.sub_title("Step 5: The proteinPriority Flag")
    pdf.body_text(
        "When programPhase = 'titration', a proteinPriority flag is set to true. This multiplies the "
        "protein deficit score by 1.5x in the focus engine, ensuring protein surfaces in the top 3 "
        "daily focuses even when hydration or fiber deficits are numerically higher. At peak "
        "therapeutic dose, protein is the single highest-impact daily action for lean mass preservation."
    )

    # ══════════════════════════════════════════════
    # 5. SIDE-EFFECT RULES ENGINE
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("5", "Side-Effect Rules Engine")

    pdf.body_text(
        "When a patient reports side effects (during onboarding or via daily logging), the targets "
        "engine applies condition-specific adjustments. There are 13 evidence-based rules covering "
        "the most common GLP-1 side effects."
    )

    pdf.table(
        ["Side Effect", "Key Adjustments"],
        [
            ["Constipation", "+500ml water, +5g fiber (soluble first), avoid cheese/white rice, prioritize chia/prunes"],
            ["Diarrhea", "+400ml water, -5g fiber (avoid cruciferous), prioritize bananas/rice/toast (BRAT)"],
            ["Nausea", "-300 steps, -10 active min, 6 small meals, avoid fatty/fried, prioritize ginger/crackers"],
            ["Vomiting", "+400ml water, -500 steps, -15 active min, 6 small meals, electrolyte repletion"],
            ["Fatigue", "-1000 steps, -15 active min, +5% carbs for energy"],
            ["Headache", "+300ml water, -500 steps, -10 active min"],
            ["Appetite Loss", "+10% protein, 6 small meals, prioritize calorie-dense nutrient-rich foods"],
            ["Dehydration", "+600ml water, electrolyte recommendation"],
            ["Dizziness", "+300ml water, -500 steps, -10 active min"],
            ["Muscle Loss", "+15% protein, resistance training flag, prioritize eggs/yogurt/chicken"],
            ["Heartburn", "-5% fat, avoid citrus/tomato/spicy, prioritize oatmeal/banana"],
            ["Food Noise", "+5% protein (satiety), prioritize high-volume low-cal foods"],
            ["Bloating / Sulfur Burps", "+200ml water, avoid carbonated drinks/high-fat, prioritize peppermint/ginger"],
        ],
        [35, 131]
    )

    pdf.sub_title("Conflict Resolution")
    pdf.body_text(
        "When multiple side effects are active simultaneously, conflicts are resolved with explicit "
        "priority rules:"
    )
    pdf.bullet("Water: MAX of all deltas (hydration is never reduced)")
    pdf.bullet("Protein: MAX (protein is never reduced; lean mass preservation always wins)")
    pdf.bullet("Fiber: decrease wins (if diarrhea + constipation are both present, fiber goes down)")
    pdf.bullet("Fat: most restrictive rule wins")
    pdf.bullet("Severity and recency weight the strength of each adjustment")

    # ══════════════════════════════════════════════
    # 6. THE SCORING SYSTEM
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("6", "The Scoring System")

    pdf.body_text(
        "The scoring system is TitraHealth's core feedback mechanism. It converts raw behavioral "
        "data into a single number that reflects how well the patient's daily habits are supporting "
        "their GLP-1 medication."
    )

    pdf.sub_title("Two-Ring Model")
    pdf.body_text(
        "The home screen displays two concentric animated SVG rings:"
    )
    pdf.bold_bullet("Inner Ring (ROUTINE / GLP-1 Adherence): ", "How well you're supporting your medication through daily behaviors. Visible to all users.")
    pdf.bold_bullet("Outer Ring (READINESS / Recovery): ", "Wearable-driven recovery score based on HRV, resting heart rate, sleep, and SpO2. Only visible when Apple Health is connected.")

    pdf.sub_title("GLP-1 Adherence Score: Four Pillars")
    pdf.table(
        ["Pillar", "What It Measures", "How It's Scored"],
        [
            ["Medication (35%)", "Injection on time, streak consistency", "Binary pass/fail per day + streak bonus"],
            ["Side Effects (25%)", "Side-effect burden", "Frequency (40%) + severity (60%), GI x1.3 multiplier"],
            ["Nutrition (25%)", "Protein, fiber, hydration vs targets", "% of personalized daily target achieved"],
            ["Activity (15%)", "Steps + active minutes vs targets", "% of personalized daily target achieved"],
        ],
        [35, 55, 66]
    )

    pdf.body_text(
        "Components are adaptive: if no food is logged, nutrition is excluded and weights redistribute. "
        "If no wearable data exists, the recovery ring is hidden entirely (no empty ring or broken UI)."
    )

    pdf.sub_title("Phase-Weighted Scoring")
    pdf.body_text(
        "Score weights change based on the patient's clinical phase. Early on, medication adherence "
        "matters most. As the patient stabilizes, nutrition and activity get more weight."
    )
    pdf.table(
        ["Phase", "Medication", "Side Effects", "Nutrition", "Activity"],
        [
            ["Initiation", "45%", "30%", "15%", "10%"],
            ["Titration", "35%", "25%", "25%", "15%"],
            ["Maintenance", "30%", "20%", "30%", "20%"],
        ],
        [35, 33, 33, 33, 33]
    )

    pdf.sub_title("14-Day Rolling Average")
    pdf.body_text(
        "The displayed score is NOT a snapshot of today. It is a 14-day linear weighted average: "
        "today's score has weight 14, yesterday has weight 13, 13 days ago has weight 1. Days with no "
        "data are excluded entirely (no penalty for not logging, but no credit either)."
    )
    pdf.body_text(
        "Clinical rationale: Behavioral adherence has a compounding effect. A patient who is 80% "
        "adherent for 14 days straight is far better off than a patient who scored 100% one day and "
        "30% the next 13. The rolling score rewards consistency, which is the actual outcome predictor."
    )

    pdf.sub_title("Medication Streak Logic")
    pdf.bullet("Weekly injectables: Cycle-day logic. Injection logged within the expected window earns streak credit.")
    pdf.bullet("Daily drugs (liraglutide, oral semaglutide, orforglipron): Stricter daily consistency. Missing a day breaks the streak.")

    pdf.sub_title("Focus Engine")
    pdf.body_text(
        "generateFocuses() surfaces the top 3 priority action items based on phase-weighted deficits. "
        "If protein is at 40% of target during titration (when nutrition weight is 25%), it gets "
        "flagged. When proteinPriority is true, the protein deficit is multiplied by 1.5x to ensure "
        "it surfaces. Focus cards appear on the home screen as actionable guidance."
    )

    # ══════════════════════════════════════════════
    # 7. PK ENGINE
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("7", "Pharmacokinetic (PK) Engine")

    pdf.body_text(
        "TitraHealth models drug levels in the patient's body using FDA-sourced population "
        "pharmacokinetic parameters and the Bateman equation. This powers the injection cycle "
        "visualization, appetite suppression forecasting, and shot-phase classification."
    )

    pdf.sub_title("The Bateman Equation")
    pdf.body_text(
        "C(t) = (Dose x ka) / (ka - ke) x (e^(-ke*t) - e^(-ka*t))\n\n"
        "Where ka = absorption rate constant, ke = elimination rate constant, and t = hours since "
        "dose. The result is normalized to 0-100% of peak concentration."
    )

    pdf.sub_title("Drug-Specific Parameters")
    pdf.table(
        ["Drug", "ka (1/hr)", "ke (1/hr)", "Half-Life", "Time to Peak"],
        [
            ["Semaglutide", "0.0476", "0.00433", "160 hours", "56 hours"],
            ["Tirzepatide", "0.135", "0.00578", "120 hours", "24 hours"],
            ["Dulaglutide", "0.0525", "0.00578", "120 hours", "48 hours"],
            ["Liraglutide", "0.14", "0.0533", "13 hours", "11 hours"],
            ["Oral Semaglutide", "7.0", "0.00439", "158 hours", "1 hour"],
            ["Orforglipron", "0.45", "0.01155", "60 hours", "8 hours"],
        ],
        [35, 25, 25, 30, 30]
    )

    pdf.sub_title("Curve Generation")
    pdf.bullet("Weekly injectables: Full cycle curve from injection day to next dose (7 or 14 day span, 28 high-resolution points)")
    pdf.bullet("Daily drugs: 7-point intraday curve (0.5h to 24h post-dose) showing the daily absorption-elimination cycle")
    pdf.bullet("Both support steady-state calculation for patients on established regimens")

    pdf.sub_title("Shot Phase System (Weekly Injectables)")
    pdf.table(
        ["Phase", "Description", "Clinical Meaning"],
        [
            ["Shot", "Injection day", "Drug absorbing, minimal effect yet"],
            ["Peak", "Max plasma concentration", "Strongest appetite suppression, most common GI symptoms"],
            ["Balance", "Therapeutic steady state", "Moderate, stable suppression"],
            ["Reset", "Approaching next dose", "Drug levels declining, appetite returning"],
        ],
        [25, 50, 81]
    )

    pdf.sub_title("Appetite Suppression Mapping")
    pdf.body_text(
        "PK concentration maps to appetite suppression via a dose-tier ceiling. Starter doses "
        "(e.g., semaglutide 0.25mg) have a ceiling of ~22% suppression. Maintenance doses (e.g., "
        "semaglutide 2.4mg) have a ceiling of ~65%. Tirzepatide has a higher ceiling (up to 72%) "
        "due to dual GIP/GLP-1 agonism. Formula: suppression = 5 + (pkPct / 100) x (ceiling - 5)."
    )

    # ══════════════════════════════════════════════
    # 8. ESCALATION PHASE ENGINE
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("8", "Escalation Phase Engine")

    pdf.body_text(
        "The escalation phase engine classifies the patient into a clinical phase based on their "
        "program week and current dose. Each phase has specific coaching emphasis, behavioral "
        "priorities, and target modifiers."
    )

    pdf.sub_title("Semaglutide Titration Schedule")
    pdf.table(
        ["Weeks", "Expected Dose", "Phase", "Focus"],
        [
            ["1-4", "0.25 mg", "Initiation", "Establish injection routine, manage GI"],
            ["5-8", "0.5 mg", "Low Therapeutic", "Build protein habits, hydration"],
            ["9-12", "1.0 mg", "Mid Therapeutic", "Optimize nutrition, track progress"],
            ["13-16", "1.7 mg", "High Therapeutic", "Lean mass protection, resistance training"],
            ["17+", "2.4 mg", "Max Dose / Maintenance", "Sustain habits, metabolic adaptation"],
        ],
        [20, 30, 35, 71]
    )

    pdf.sub_title("Tirzepatide Titration Schedule")
    pdf.table(
        ["Weeks", "Expected Dose", "Phase", "Focus"],
        [
            ["1-4", "2.5 mg", "Initiation", "Establish routine, expect minimal suppression"],
            ["5-8", "5 mg", "Low Therapeutic", "Appetite suppression begins, protein focus"],
            ["9-12", "7.5 mg", "Mid Therapeutic", "Active weight loss, monitor GI"],
            ["13-16", "10 mg", "High Therapeutic", "Peak weight loss, lean mass critical"],
            ["17-20", "12.5 mg", "High Plus", "Continued loss, resistance training"],
            ["21+", "15 mg", "Max Dose", "Maintenance transition"],
        ],
        [20, 30, 35, 71]
    )

    pdf.sub_title("Liraglutide (Daily) Schedule")
    pdf.body_text(
        "Week 1: 0.6 mg/day (Initiation), Week 2: 1.2 mg (Low), Week 3: 1.8 mg (Mid), "
        "Week 4: 2.4 mg (High), Week 5+: 3.0 mg (Maintenance). The 13-hour half-life means "
        "daily injection consistency is the primary lever. Missed doses are not forgiven the way "
        "they are with semaglutide's 7-day half-life."
    )

    pdf.sub_title("Phase Metadata")
    pdf.body_text("Each phase carries structured metadata that drives downstream features:")
    pdf.bullet("weeklyFocus: Therapeutic focus for that week (e.g., 'Establish injection routine')")
    pdf.bullet("behavioralEmphasis: Array of 2-3 behavioral priorities (e.g., ['hydration', 'protein', 'gentle movement'])")
    pdf.bullet("isPlasticityWindow: True during weeks 5-16 (peak habit-formation period with highest behavioral retention)")
    pdf.bullet("isAcceleratedEscalator: Detected when user is ahead of expected dose schedule")
    pdf.bullet("isSlowTitrator: Detected when user is behind expected dose schedule")

    # ══════════════════════════════════════════════
    # 9. CYCLE INTELLIGENCE & BIOMETRICS
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("9", "Cycle Intelligence & Biometrics")

    pdf.sub_title("Appetite Forecast")
    pdf.body_text(
        "For weekly injectables, the app generates a 7-14 day forecast strip showing predicted "
        "appetite suppression for each day of the injection cycle. Each day includes: appetite "
        "suppression percentage (5-100%, dose-scaled), energy forecast (60-100%), and a state "
        "label (peak_suppression, moderate_suppression, returning, near_baseline). Shot days and "
        "today are highlighted."
    )
    pdf.body_text(
        "For daily drugs, a 6-block intraday forecast shows four-hour windows with PK concentration "
        "and suppression percentage. This helps patients understand when appetite suppression is "
        "strongest vs. weakest throughout the day."
    )

    pdf.sub_title("CycleIQ Biometric Interpretation")
    pdf.body_text(
        "For patients with wearable data (Apple Health), CycleIQ interprets HRV, resting "
        "heart rate, and sleep patterns against expected GLP-1 pharmacodynamic effects."
    )
    pdf.body_text("Classifications for each biometric:")
    pdf.bullet("expected_glp1: Within tolerance of what the drug typically causes at this phase")
    pdf.bullet("expected_positive: Better than expected (e.g., HRV improving faster than typical)")
    pdf.bullet("mild_unusual: Slightly outside expected range (worth monitoring)")
    pdf.bullet("concerning: Significantly unusual (may warrant clinical attention)")

    pdf.sub_title("Metabolic Adaptation Detection")
    pdf.body_text(
        "The system monitors calorie efficiency (calories per step) and weight trends to detect "
        "metabolic plateaus. Plateau risk is classified as: none, approaching, or detected. When "
        "a plateau is detected, the clinical alerts system triggers a plateau protocol alert with "
        "guidance on breaking through the stall."
    )

    # ══════════════════════════════════════════════
    # 10. LOGGING SYSTEM
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("10", "Logging System")

    pdf.body_text(
        "The FAB (floating action button) on the tab bar opens a 10-item grid sheet providing "
        "quick access to all logging actions. Each action routes to a dedicated screen optimized "
        "for that specific data type."
    )

    pdf.sub_title("Food Logging (4 Methods)")
    pdf.table(
        ["Method", "How It Works"],
        [
            ["Describe", "Free text -> GPT-4o-mini parses into items -> USDA macro lookup -> confirm and log"],
            ["Photo", "Camera -> GPT-4o-mini vision identifies food + estimates portions -> USDA lookup -> confirm"],
            ["Barcode", "Camera scanner -> Open Food Facts API -> product nutrition auto-populated"],
            ["Search", "Direct USDA FoodData Central search -> select item -> adjust serving -> log"],
        ],
        [30, 136]
    )
    pdf.body_text(
        "All food logs capture: name, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type "
        "(breakfast/lunch/dinner/snack), and source method."
    )

    pdf.sub_title("Injection Logging")
    pdf.bullet("Dose auto-populated from profile (editable per-log)")
    pdf.bullet("6-zone injection site grid (left/right abdomen, thigh, upper arm) with rotation suggestion")
    pdf.bullet("Batch number and notes fields")
    pdf.bullet("Voice input support")
    pdf.bullet("Fasting window toggle for oral medications")
    pdf.bullet("On save: updates lastInjectionDate in profile and resets PK curve")

    pdf.sub_title("Weight Logging")
    pdf.bullet("Interactive horizontal ruler with haptic feedback")
    pdf.bullet("Imperial/metric toggle with automatic conversion")
    pdf.bullet("HealthKit write integration")
    pdf.bullet("Voice input support")

    pdf.sub_title("Activity Logging")
    pdf.bullet("9 workout types (walk, run, bike, swim, strength, yoga, HIIT, sports, other)")
    pdf.bullet("Intensity slider with MET-based calorie estimation using body weight and duration")
    pdf.bullet("Manual steps input with auto-calculation from activity type")
    pdf.bullet("Duration gauge (0-120 minutes)")

    pdf.sub_title("Side Effect Logging")
    pdf.bullet("Interactive 0-10 severity sliders per symptom with haptic feedback")
    pdf.bullet("Customizable effect list grouped by category (Digestive, Appetite, Physical, Mental)")
    pdf.bullet("Routes to Side Effect Impact screen showing before/after target adjustments")
    pdf.bullet("Specific food guidance: foods to prioritize and avoid for each condition")
    pdf.bullet("AI coach card with contextual quick-question chips")

    pdf.sub_title("Weekly Check-In (7 Domains)")
    pdf.body_text("A unified single-session assessment covering:")
    pdf.bullet("GI Burden: digestive symptom severity")
    pdf.bullet("Energy/Mood: energy levels and emotional state")
    pdf.bullet("Appetite: hunger and satiety patterns")
    pdf.bullet("Food Noise: intrusive food thoughts (5-question Likert scale, scored 0-20)")
    pdf.bullet("Sleep Quality: duration and restfulness")
    pdf.bullet("Activity Quality: exercise capacity and motivation")
    pdf.bullet("Mental Health: emotional wellbeing (scores >= 15 trigger a provider warning banner)")
    pdf.body_text(
        "Each domain produces a 0-100 normalized score. Results show sparkline trends, target "
        "impact computation, and contextual guidance."
    )

    # ══════════════════════════════════════════════
    # 11. AI INTEGRATION
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("11", "AI Integration")

    pdf.body_text(
        "TitraHealth uses GPT-4o-mini as its primary AI engine, integrated across multiple surfaces "
        "throughout the app. Every AI interaction receives a context snapshot containing the patient's "
        "medication, dose, phase, recent logs, scores, and goals."
    )

    pdf.sub_title("AI-Powered Features")

    pdf.sub_sub_title("Food Parsing (Describe)")
    pdf.body_text(
        "When a patient types 'chicken breast with rice and broccoli', GPT-4o-mini breaks it into "
        "individual components, estimates portion sizes, and returns structured nutrition data. Each "
        "item is cross-referenced against the USDA FoodData Central database for accuracy."
    )

    pdf.sub_sub_title("Food Vision (Photo)")
    pdf.body_text(
        "Patient takes a photo of their meal. The image is sent as base64 to GPT-4o-mini's vision "
        "endpoint. The model identifies foods, estimates portions from visual context, and returns "
        "structured data for USDA lookup."
    )

    pdf.sub_sub_title("Daily Insights")
    pdf.body_text(
        "The home screen displays 1-3 AI-generated bullets that are personalized to the patient's "
        "current data. These are cached per day to avoid redundant API calls and show skeleton "
        "loading states while generating."
    )

    pdf.sub_sub_title("Score Coaching")
    pdf.body_text(
        "The score detail screen includes an AI coach note interpreting the patient's score "
        "breakdown. This note is phase-aware and references specific metric deficits."
    )

    pdf.sub_sub_title("Conversational Chat")
    pdf.body_text(
        "Full chat interface accessible from the FAB sheet or via floating overlay (triggered by "
        "tapping metric cards). Features: message history persistence in Supabase, image upload "
        "support, suggestion chips, medical disclaimer, and typing indicator. The system prompt "
        "identifies the AI as a GLP-1 medication companion with the patient's full clinical context."
    )

    pdf.sub_sub_title("Weekly Summaries")
    pdf.body_text(
        "AI-generated weekly progress narratives summarizing weight trends, nutrition compliance, "
        "activity levels, and check-in scores."
    )

    pdf.info_box("Context Injection",
        "Every AI conversation receives a structured context snapshot containing: medication brand "
        "and dose, escalation phase, program week, recent injection/food/weight/activity/side-effect "
        "logs, rolling adherence score, daily targets, and goal progress. This ensures every response "
        "is grounded in the patient's actual clinical situation, not generic advice."
    )

    # ══════════════════════════════════════════════
    # 12. EDUCATION HUB
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("12", "Education Hub")

    pdf.body_text(
        "The Education tab is a comprehensive, evidence-based content library organized for "
        "progressive learning."
    )

    pdf.sub_title("Content Sections")

    pdf.sub_sub_title("Phase-Aware Weekly Focus Card")
    pdf.body_text(
        "Displays the current program week number and phase-specific tips. Content adapts as "
        "the patient progresses through their titration schedule."
    )

    pdf.sub_sub_title("Myth vs. Fact Cards")
    pdf.body_text(
        "7 tap-to-reveal cards debunking common GLP-1 misconceptions. Examples: 'GLP-1 meds are "
        "just for weight loss' (Fact: also approved for type 2 diabetes, cardiovascular risk), "
        "'You don't need to exercise on GLP-1s' (Fact: resistance training is critical for "
        "lean mass preservation)."
    )

    pdf.sub_sub_title("Side Effect Decoder")
    pdf.body_text(
        "Searchable symptom grid color-coded by severity: green (expected/normal), yellow "
        "(monitor closely), red (call your doctor). Categories include expected symptoms (nausea, "
        "reduced appetite, constipation, fatigue), monitor symptoms (vomiting >2x/day, severe "
        "constipation, hair shedding, mood changes), and doctor-call symptoms (severe abdominal "
        "pain, jaundice, difficulty swallowing, allergic reactions)."
    )

    pdf.sub_sub_title("When to Call Your Doctor")
    pdf.body_text("9 warning signs categorized by urgency level (immediate vs. monitor).")

    pdf.sub_sub_title("Article Library")
    pdf.body_text(
        "10+ evidence-based articles stored in Supabase, each with title, category, body in "
        "markdown, reading time, and phase relevance. Articles are tappable and open in a "
        "dedicated detail screen."
    )

    pdf.sub_sub_title("Deep Dives")
    pdf.body_text(
        "7 expandable accordion sections with 5-6 Q&A pairs each: Understanding Your Medication, "
        "Injection Technique & Storage, Nutrition Guide, Lifestyle & Exercise, Mental Health & "
        "Food Noise, Managing Side Effects, and Frequently Asked Questions."
    )

    # ══════════════════════════════════════════════
    # 13. CLINICAL ALERTS
    # ══════════════════════════════════════════════
    pdf.section_title("13", "Clinical Alerts")

    pdf.body_text(
        "The app generates evidence-based clinical flags based on program week, behavioral metrics, "
        "and logged data. These are not diagnostic; they are prompts for patient awareness and "
        "provider conversation."
    )

    pdf.table(
        ["Alert", "Trigger", "Severity"],
        [
            ["Iron Lab Reminder", "Program week 8", "Info"],
            ["Vitamin D Lab Reminder", "Program week 12", "Info"],
            ["Hair Loss Reassurance", "Weeks 12-26 + hair loss logged", "Warning"],
            ["Plateau Protocol", "Week 20+ + weight stall detected", "Info"],
            ["Resistance Training", "Week 5+ + sedentary/light activity", "Warning"],
            ["Lean Mass Alert", "Week 8+ + protein < 60% of target", "Warning"],
            ["Dropout Risk", "Weeks 17-26 + 5+ days since last log", "Info"],
        ],
        [40, 72, 25]
    )

    # ══════════════════════════════════════════════
    # 14. HOME DASHBOARD
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("14", "Home Dashboard")

    pdf.body_text(
        "The home screen is the patient's daily command center, designed to answer 'How am I doing?' "
        "and 'What should I focus on?' at a glance."
    )

    pdf.sub_title("Components (Top to Bottom)")
    pdf.bold_bullet("Medication Banner: ", "Current medication name, dose, program week, and day count since start.")
    pdf.bold_bullet("Phase Label: ", "Current injection cycle phase (Shot, Peak, Balance, Reset) with description.")
    pdf.bold_bullet("Score Card: ", "Dual concentric animated SVG rings. Inner = ROUTINE (14-day rolling adherence). Outer = READINESS (wearable recovery). Tapping opens score detail drill-down.")
    pdf.bold_bullet("Daily Actuals vs Targets: ", "Progress bars for protein, water, fiber, and steps showing current vs. personalized targets.")
    pdf.bold_bullet("AI Insights Card: ", "1-3 AI-generated contextual bullets (cached daily, skeleton loading).")
    pdf.bold_bullet("Focus Cards: ", "Top 3 phase-weighted action items from the focus engine.")
    pdf.bold_bullet("Calendar Dropdown: ", "Interactive calendar showing injection days, logged days, and today.")
    pdf.bold_bullet("Daily Log Summary: ", "Expandable card showing all food, activity, weight, injection, and side effect logs with edit functionality.")
    pdf.bold_bullet("Appetite Forecast Strip: ", "Visual forecast of appetite suppression across the injection cycle or intraday for daily drugs.")
    pdf.bold_bullet("Clinical Alerts: ", "Evidence-based flags when triggered by program state.")
    pdf.bold_bullet("Weekly Check-In Card: ", "Prompt for periodic health assessment when due.")

    # ══════════════════════════════════════════════
    # 15. SETTINGS & INTEGRATIONS
    # ══════════════════════════════════════════════
    pdf.section_title("15", "Settings & Integrations")

    pdf.sub_title("Profile Management")
    pdf.body_text(
        "All onboarding data is editable post-onboarding: medication and dose, body measurements, "
        "goals (target weight, weekly loss rate), and personal info (sex, birthday, activity level). "
        "Changes propagate to target recalculation."
    )

    pdf.sub_title("Appearance")
    pdf.body_text("Full dark/light mode toggle persisted via AsyncStorage. The entire design system adapts: backgrounds, card surfaces, text colors, blur tints. Brand orange (#FF742A) stays consistent across both modes.")

    pdf.sub_title("Apple Health Integration")
    pdf.body_text(
        "Read-only sync for steps, HRV, resting heart rate, SpO2, and body mass. When connected, "
        "this data powers the Recovery (outer) ring, CycleIQ biometric interpretation, and metabolic "
        "adaptation detection."
    )

    # ══════════════════════════════════════════════
    # 16. DATA ARCHITECTURE
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("16", "Data Architecture")

    pdf.sub_title("Backend: Supabase")
    pdf.body_text(
        "Supabase provides authentication (email/password, Google, Apple OAuth), PostgreSQL database, "
        "and Edge Functions. All patient data is stored in structured tables:"
    )
    pdf.table(
        ["Table", "Purpose"],
        [
            ["profiles", "User profile, medication, dose, goals, wearable tokens"],
            ["user_goals", "Computed daily targets (calories, protein, fiber, steps)"],
            ["injection_logs", "Dose, date, site, notes"],
            ["food_logs", "Name, calories, macros, fiber, meal_type, source"],
            ["weight_logs", "Weight in lbs/kg, timestamp, source"],
            ["activity_logs", "Type, duration, steps, calories burned, date"],
            ["side_effect_logs", "Effect type, severity, phase, notes, timestamp"],
            ["weekly_checkins", "7-domain scores, checkin_date, type"],
            ["articles", "Title, category, body markdown, reading time, phase"],
        ],
        [38, 128]
    )

    pdf.sub_title("State Management")
    pdf.table(
        ["Layer", "Technology", "What It Holds"],
        [
            ["Profile", "React Context + AsyncStorage", "Full user profile, onboarding draft"],
            ["Auth", "Zustand (user-store)", "Session, session loaded state, profile row"],
            ["Logs", "Zustand (log-store)", "All daily entries, CRUD operations"],
            ["Health/Scores", "React Context (useReducer)", "Daily actuals, targets, wearable, scores"],
            ["Insights AI", "Zustand", "Pre-fetched AI text for tabs"],
            ["Preferences", "Zustand + AsyncStorage", "Dark mode, Apple Health enabled"],
            ["Biometrics", "Zustand (biometric-store)", "CycleIQ wearable interpretations"],
        ],
        [30, 52, 84]
    )

    pdf.sub_title("Tech Stack")
    pdf.body_text(
        "React Native 0.81.5 + Expo Router ~6.0.23 (file-based routing), React 19.1.0, "
        "TypeScript ~5.9.2, react-native-reanimated ~4.1.1 for animations, expo-blur for "
        "glassmorphism, react-native-svg for animated ring arcs, expo-haptics for tactile "
        "feedback, Zustand ~5.0.11 for state, and @supabase/supabase-js for backend."
    )

    # ══════════════════════════════════════════════
    # 17. FUTURE VISION & ROADMAP
    # ══════════════════════════════════════════════
    pdf.add_page()
    pdf.section_title("17", "Future Vision & Roadmap")

    pdf.body_text(
        "TitraHealth's long-term vision is to become the definitive companion platform for "
        "GLP-1 therapy, expanding from individual tracking into clinical integration, community "
        "support, and comprehensive metabolic health management."
    )

    pdf.sub_title("High Priority (Near-Term)")

    pdf.sub_sub_title("Notification System")
    pdf.body_text(
        "Push alerts for upcoming injections, daily nutritional reminders, craving-day alerts, "
        "and weekly check-in prompts. The infrastructure (expo-notifications) is already in place; "
        "the scheduling logic and user preferences UI need to be connected."
    )

    pdf.sub_sub_title("Supabase Profile Persistence")
    pdf.body_text(
        "Currently ProfileContext uses an in-memory Map with AsyncStorage fallback. Production "
        "implementation will use Supabase profiles.metadata for full session persistence across "
        "cold restarts and device transfers."
    )

    pdf.sub_sub_title("Apple Health Two-Way Sync")
    pdf.body_text(
        "Expand from read-only to bidirectional sync: when the patient logs weight or activity "
        "in TitraHealth, it writes back to HealthKit. This positions TitraHealth as the patient's "
        "single source of truth."
    )

    pdf.sub_sub_title("Offline Support")
    pdf.body_text(
        "Queue logs locally when offline; sync when connectivity returns. Critical for rural "
        "areas and commute scenarios where patients want to log immediately but don't have signal."
    )

    pdf.sub_sub_title("Analytics & Telemetry")
    pdf.body_text(
        "Segment or Amplitude event tracking for onboarding completion rates, daily active users, "
        "feature adoption, and retention funnels. Essential for product-market fit iteration."
    )

    pdf.sub_sub_title("Biometric Calibration")
    pdf.body_text(
        "Per-user HRV and resting HR baseline establishment (currently stubbed). This will "
        "make the Recovery ring meaningful from day one rather than requiring weeks of data."
    )

    pdf.sub_title("Medium Priority (Mid-Term)")

    pdf.sub_sub_title("Continuous Glucose Monitor (CGM) Integration")
    pdf.body_text(
        "Dexcom API integration for real-time glucose trending. GLP-1s significantly affect "
        "glycemic response; overlaying CGM data with PK curves and meal logs would provide "
        "unprecedented insight into individual drug response."
    )

    pdf.sub_sub_title("Telehealth Integration")
    pdf.body_text(
        "Video consultation booking with GLP-1-specialized providers. Pre-visit summaries "
        "auto-generated from the patient's TitraHealth data (scores, weight trend, side effects, "
        "adherence). Post-visit note summaries with action items."
    )

    pdf.sub_sub_title("Meal Plan Templates")
    pdf.body_text(
        "Pre-built, phase-aware meal plans aligned to the patient's daily targets. Protein-forward "
        "plans for titration, maintenance plans for plateau phase, GI-gentle plans for patients "
        "with active nausea or constipation."
    )

    pdf.sub_sub_title("Insurance Verification")
    pdf.body_text(
        "Cost calculator and formulary lookup. Many patients face insurance barriers with GLP-1s; "
        "helping them navigate coverage, prior authorizations, and manufacturer coupons adds "
        "significant value."
    )

    pdf.sub_sub_title("Export to Spreadsheet")
    pdf.body_text("CSV export of all logs for clinician review. Some providers request structured data for chart notes.")

    pdf.sub_sub_title("Batch Food Import")
    pdf.body_text("Calendar-style meal plan batch entry for patients who meal prep weekly.")

    pdf.sub_sub_title("A/B Testing Framework")
    pdf.body_text("Variant testing on messaging, coaching tone, and UI patterns to optimize engagement and retention.")

    pdf.sub_title("Long-Term Vision")

    pdf.sub_sub_title("Peer Community")
    pdf.body_text(
        "Anonymous milestone sharing, group challenges, and peer support. Weight loss journeys "
        "are social; patients who feel connected to others on the same medication have higher "
        "adherence rates."
    )

    pdf.sub_sub_title("Wearable Ecosystem Expansion")
    pdf.body_text(
        "Fitbit, Whoop, and Apple Watch ECG/PPG integration for advanced biometric metrics. "
        "The scoring and CycleIQ systems are already designed to accept multi-source wearable data."
    )

    pdf.sub_sub_title("Smartwatch Companion App")
    pdf.body_text(
        "Wear OS and watchOS widgets for injection reminders, quick-log UI (water, activity), "
        "and score glance. The watch becomes the nudge layer; the phone remains the analysis layer."
    )

    pdf.sub_sub_title("Pharmacy Refill Integration")
    pdf.body_text(
        "SMS/push alerts when refills are due, direct API handshake with pharmacy chains for "
        "refill sync. GLP-1 supply chain issues make timely refills critical."
    )

    pdf.sub_sub_title("Coach Onboarding Calls")
    pdf.body_text(
        "Scheduled video calls with registered GLP-1 health coaches. The coach receives the "
        "patient's TitraHealth profile and recent data before the call."
    )

    pdf.sub_sub_title("Social Sharing")
    pdf.body_text("TikTok/Instagram milestone clips (weight loss celebrations, side effect recovery milestones).")

    pdf.sub_sub_title("Multi-User Household")
    pdf.body_text("Family/partner support and observation mode for accountability partners or caregivers.")

    pdf.info_box("The Closed Feedback Loop",
        "Everything in TitraHealth forms a closed feedback loop: the patient logs data -> the scoring "
        "engine evaluates it against personalized, phase-aware targets -> AI generates contextual "
        "coaching -> the patient adjusts behavior -> logs again. Every feature (PK curves, side-effect "
        "rules, weekly check-ins, clinical alerts) feeds back into making the next day's guidance "
        "more relevant. The future roadmap (CGM, telehealth, community) extends this loop into "
        "clinical integration and social support."
    )

    # ── BACK COVER ──
    pdf.add_page()
    pdf.ln(80)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(*TitraPDF.ORANGE)
    pdf.cell(0, 12, "TitraHealth", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(*TitraPDF.MID_GRAY)
    pdf.cell(0, 8, "Smarter support for your GLP-1 journey.", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 7, "Rev 14  |  March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, "Team Titra Health", align="C", new_x="LMARGIN", new_y="NEXT")

    # ── OUTPUT ──
    out_path = os.path.join(os.path.dirname(__file__), "TitraHealth_Product_Summary.pdf")
    pdf.output(out_path)
    print(f"PDF generated: {out_path}")
    return out_path


if __name__ == "__main__":
    build_pdf()
