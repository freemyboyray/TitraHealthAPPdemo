#!/usr/bin/env python3
"""Generate a professional Operating Agreement PDF for Titra Health LLC."""

from fpdf import FPDF
import os

class AgreementPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 10, "Operating Agreement - Titra Health LLC", align="C")
            self.ln(5)
            self.set_draw_color(180, 180, 180)
            self.line(20, self.get_y(), 190, self.get_y())
            self.ln(5)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        if self.page_no() > 1:
            self.set_draw_color(180, 180, 180)
            self.line(20, self.get_y() - 3, 190, self.get_y() - 3)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def title_page(self):
        self.add_page()
        self.ln(55)
        self.set_font("Helvetica", "B", 26)
        self.set_text_color(30, 30, 30)
        self.cell(0, 14, "OPERATING AGREEMENT", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)
        self.set_font("Helvetica", "", 14)
        self.cell(0, 10, "of", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
        self.set_font("Helvetica", "B", 22)
        self.cell(0, 14, "TITRA HEALTH LLC", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_draw_color(60, 60, 60)
        self.line(65, self.get_y(), 145, self.get_y())
        self.ln(10)
        self.set_font("Helvetica", "", 13)
        self.cell(0, 8, "A Georgia Limited Liability Company", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(30)
        self.set_font("Helvetica", "", 12)
        self.cell(0, 8, "Effective Date: April 9, 2026", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(50)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "This document contains confidential information.", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 6, "Unauthorized distribution is prohibited.", align="C", new_x="LMARGIN", new_y="NEXT")

    def article_heading(self, text):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(30, 30, 30)
        self.ln(6)
        self.cell(0, 10, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(60, 60, 60)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(4)

    def section(self, number, title, body):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 30, 30)
        self.cell(0, 7, f"{number}  {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5.5, body)
        self.ln(3)

    def bullet_list(self, items):
        for item in items:
            self.set_font("Helvetica", "", 10.5)
            self.set_text_color(50, 50, 50)
            self.multi_cell(0, 5.5, f"     {item}")
            self.ln(1)
        self.ln(2)

    def signature_block(self, name, role):
        self.ln(8)
        self.set_draw_color(30, 30, 30)
        self.line(20, self.get_y(), 110, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(50, 50, 50)
        self.cell(95, 6, name)
        self.set_font("Helvetica", "", 9)
        self.cell(0, 6, "Date: _____________________")
        self.ln(5)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, role)
        self.ln(3)


def build():
    pdf = AgreementPDF()
    pdf.alias_nb_pages()
    pdf.set_margins(20, 20, 20)

    # ── Title page ──
    pdf.title_page()

    # ── Recitals ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, "RECITALS", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(50, 50, 50)

    recitals = [
        'WHEREAS, the Members desire to form a limited liability company under the laws of the State of Georgia for the purposes set forth herein;',
        'WHEREAS, the Members wish to set forth their respective rights, duties, and obligations with respect to the Company, including ownership percentages, voting authority, and management responsibilities;',
        'WHEREAS, the Members intend that this Agreement shall govern the internal affairs of the Company and the relations among the Members;',
        'NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Members agree as follows:',
    ]
    for r in recitals:
        pdf.multi_cell(0, 5.5, r)
        pdf.ln(4)

    # ── ARTICLE I ──
    pdf.article_heading("ARTICLE I -- FORMATION AND NAME")

    pdf.section("1.1", "Name.",
        'The name of the limited liability company is Titra Health LLC (the "Company").')

    pdf.section("1.2", "Formation.",
        "The Company was formed under the Georgia Limited Liability Company Act "
        "(O.C.G.A. Section  14-11-100 et seq.) (the \"Act\") by filing Articles of Organization "
        "with the Georgia Secretary of State on April 9, 2026.")

    pdf.section("1.3", "Principal Office.",
        "The principal office of the Company shall be at an address determined by "
        "the Members from time to time. The initial principal office shall be at the "
        "address of the Registered Agent as set forth in the Articles of Organization.")

    pdf.section("1.4", "Registered Agent.",
        "The registered agent and registered office shall be as set forth in the "
        "Articles of Organization, as amended from time to time by a filing with "
        "the Georgia Secretary of State.")

    pdf.section("1.5", "Purpose.",
        "The Company is formed for the purpose of developing, marketing, and operating "
        "the TitraHealth mobile application and related health technology products and "
        "services, including but not limited to GLP-1 medication tracking, health data "
        "analytics, and any other lawful business the Members may determine.")

    pdf.section("1.6", "Term.",
        "The Company shall have perpetual existence and shall continue until dissolved "
        "in accordance with this Agreement or the Act.")

    # ── ARTICLE II ──
    pdf.article_heading("ARTICLE II -- DEFINITIONS")

    pdf.section("2.1", "Definitions.",
        "As used in this Agreement, the following terms shall have the meanings set forth below:")

    definitions = [
        ('"Act"', "means the Georgia Limited Liability Company Act, O.C.G.A. Section  14-11-100 et seq., as amended."),
        ('"Agreement"', "means this Operating Agreement, as amended from time to time."),
        ('"Capital Account"', "means the individual account maintained for each Member reflecting their capital contributions, allocations of profit and loss, and distributions."),
        ('"Capital Contribution"', "means the total amount of cash or the fair market value of property contributed by a Member to the Company."),
        ('"Fiscal Year"', "means the calendar year."),
        ('"Majority Vote"', "means the affirmative vote of Members holding more than 50% of the total Voting Power."),
        ('"Managing Member"', "means the Member designated to manage the day-to-day operations of the Company, initially Ibrahim Mohammad."),
        ('"Member"', "means each person who has been admitted to the Company as a member and who has not ceased to be a member."),
        ('"Membership Interest"', "means a Member's entire interest in the Company, including the right to receive allocations and distributions."),
        ('"Transfer"', "means any sale, assignment, pledge, encumbrance, hypothecation, gift, or other disposition, whether voluntary or involuntary, by operation of law or otherwise."),
        ('"Voting Power"', "means the voting percentage allocated to each Member as set forth in Section 4.2, independent of Membership Interest."),
    ]
    for term, defn in definitions:
        pdf.set_font("Helvetica", "", 10.5)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(0, 5.5, f"{term} {defn}")
        pdf.ln(2)

    # ── ARTICLE III ──
    pdf.article_heading("ARTICLE III -- MEMBERS AND MEMBERSHIP INTERESTS")

    pdf.section("3.1", "Members.",
        "The Members of the Company and their respective Membership Interests are:")
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.cell(90, 7, "     Name", new_x="RIGHT")
    pdf.cell(0, 7, "Membership Interest", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10.5)
    pdf.cell(90, 7, "     Ibrahim Mohammad", new_x="RIGHT")
    pdf.cell(0, 7, "50%", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 7, "     Ray Wade", new_x="RIGHT")
    pdf.cell(0, 7, "50%", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section("3.2", "Capital Contributions.",
        "Each Member's initial Capital Contribution, if any, is set forth in Exhibit A "
        "attached hereto and incorporated by reference.")

    pdf.section("3.3", "No Additional Contributions.",
        "No Member shall be required to make additional Capital Contributions without "
        "the unanimous written consent of all Members. Any additional contribution shall "
        "be documented by written amendment to Exhibit A.")

    pdf.section("3.4", "Capital Accounts.",
        "The Company shall maintain a separate Capital Account for each Member. Each "
        "Capital Account shall be credited with the Member's Capital Contributions and "
        "allocations of net profit, and debited with distributions and allocations of "
        "net loss.")

    pdf.section("3.5", "No Interest on Capital.",
        "No Member shall receive interest on any Capital Contribution.")

    pdf.section("3.6", "Return of Capital.",
        "No Member has the right to demand the return of any Capital Contribution except "
        "upon dissolution of the Company as provided in Article IX.")

    # ── ARTICLE IV ──
    pdf.article_heading("ARTICLE IV -- MANAGEMENT AND VOTING")

    pdf.section("4.1", "Member-Managed.",
        "The Company shall be member-managed. All Members shall have the right to "
        "participate in the management of the Company, subject to the voting provisions "
        "set forth in this Article.")

    pdf.section("4.2", "Voting Power.",
        "Voting Power shall be allocated as follows, independent of Membership Interest "
        "percentages. This allocation reflects the Members' agreement regarding operational "
        "decision-making authority and does not affect economic rights:")
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.cell(90, 7, "     Name", new_x="RIGHT")
    pdf.cell(0, 7, "Voting Power", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10.5)
    pdf.cell(90, 7, "     Ibrahim Mohammad", new_x="RIGHT")
    pdf.cell(0, 7, "51%", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 7, "     Ray Wade", new_x="RIGHT")
    pdf.cell(0, 7, "49%", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section("4.3", "Ordinary Decisions.",
        "All ordinary business decisions of the Company shall be decided by Majority Vote. "
        "Because Ibrahim Mohammad holds 51% of the Voting Power, he shall have tie-breaking "
        "authority on ordinary business matters, including but not limited to hiring, vendor "
        "selection, marketing strategy, product roadmap prioritization, and operational budgets.")

    pdf.section("4.4", "Major Decisions Requiring Unanimous Consent.",
        "Notwithstanding Section 4.3, the following actions shall require the unanimous "
        "written consent of all Members:")
    pdf.bullet_list([
        "(a)  Sale, merger, acquisition, or dissolution of the Company;",
        "(b)  Admission of new Members or issuance of additional Membership Interests;",
        "(c)  Amendment of this Operating Agreement;",
        "(d)  Incurring debt, guarantees, or obligations exceeding $10,000 individually or $25,000 in aggregate per fiscal year;",
        "(e)  Sale, lease, or encumbrance of substantially all Company assets;",
        "(f)  Changing the fundamental purpose or nature of the Company's business;",
        "(g)  Entering into any single contract or commitment exceeding $25,000 in value;",
        "(h)  Filing for bankruptcy or insolvency proceedings;",
        "(i)  Changing the Company's tax classification or making any tax election with material effect;",
        "(j)  Granting equity, profit interests, or phantom equity to any person;",
        "(k)  Entering into any transaction with a Member or their affiliates (related-party transactions);",
        "(l)  Raising capital from outside investors or issuing convertible instruments;",
        "(m)  Establishing or modifying compensation, bonuses, or benefits for any Member exceeding $5,000 per month.",
    ])

    pdf.section("4.5", "Managing Member.",
        "Ibrahim Mohammad shall serve as the Managing Member and shall be responsible for "
        "the day-to-day operations of the Company, including but not limited to:")
    pdf.bullet_list([
        "(a)  Managing the Company's bank accounts and financial operations;",
        "(b)  Executing contracts in the ordinary course of business (under $25,000);",
        "(c)  Making hiring, termination, and contractor engagement decisions;",
        "(d)  Representing the Company in dealings with third parties, vendors, and partners;",
        "(e)  Filing required reports with the Georgia Secretary of State and other regulatory bodies;",
        "(f)  Overseeing compliance with applicable laws and regulations.",
    ])

    pdf.section("4.6", "Removal of Managing Member.",
        "The Managing Member may be removed only by unanimous written consent of all Members. "
        "Upon removal, the Members shall appoint a successor Managing Member by Majority Vote.")

    pdf.section("4.7", "Fiduciary Duties.",
        "Each Member owes to the Company and to the other Members the fiduciary duties of "
        "loyalty and care as defined under the Act. No Member shall engage in self-dealing, "
        "usurp Company opportunities, or compete with the Company during the term of their "
        "membership except as permitted by Article XII.")

    pdf.section("4.8", "Duties and Commitment.",
        "Each Member shall devote such time and effort to the Company's business as is "
        "reasonably necessary for the Company to achieve its objectives. If a Member's "
        "contribution materially declines, the other Member may raise the issue under the "
        "dispute resolution provisions of Article XIII.")

    pdf.section("4.9", "Deadlock Resolution.",
        "In the event of a deadlock on any matter requiring Majority Vote (i.e., a dispute "
        "where the Managing Member's 51% vote is contested), the Members shall first attempt "
        "to resolve the matter through good-faith discussion for a period of fourteen (14) days. "
        "If the deadlock persists, the matter shall be submitted to mediation as provided in "
        "Article XIII.")

    # ── ARTICLE V ──
    pdf.article_heading("ARTICLE V -- ALLOCATIONS AND DISTRIBUTIONS")

    pdf.section("5.1", "Profits and Losses.",
        "The net profits and net losses of the Company for each Fiscal Year shall be allocated "
        "among the Members in proportion to their Membership Interests (50% / 50%).")

    pdf.section("5.2", "Distributions.",
        "Distributions of available cash shall be made at such times and in such amounts as "
        "determined by Majority Vote, allocated in proportion to Membership Interests "
        "(50% / 50%). The Company shall endeavor to make distributions at least quarterly, "
        "subject to cash availability and business needs.")

    pdf.section("5.3", "Tax Distributions.",
        "The Company shall distribute to each Member, at least quarterly, an amount reasonably "
        "estimated to cover such Member's federal, state, and local income tax liability arising "
        "from the Company's income allocated to such Member, calculated at the highest marginal "
        "individual tax rate applicable in the relevant jurisdiction.")

    pdf.section("5.4", "Limitation on Distributions.",
        "No distribution shall be made if, after giving effect to the distribution, the Company "
        "would not be able to pay its debts as they become due in the ordinary course of business, "
        "or if the distribution would violate the Act or any loan covenant.")

    pdf.section("5.5", "Withholding.",
        "The Company is authorized to withhold from distributions any amounts required by federal, "
        "state, or local tax law. Amounts withheld shall be treated as distributions to the "
        "applicable Member.")

    # ── ARTICLE VI ──
    pdf.article_heading("ARTICLE VI -- ACCOUNTING, RECORDS, AND TAX MATTERS")

    pdf.section("6.1", "Fiscal Year.",
        "The Fiscal Year of the Company shall be the calendar year (January 1 through December 31).")

    pdf.section("6.2", "Books and Records.",
        "The Company shall maintain complete and accurate books and records at its principal office, "
        "including: (a) a current list of Members with addresses and Membership Interests; "
        "(b) copies of federal, state, and local tax returns for the three most recent years; "
        "(c) copies of this Agreement and all amendments; (d) financial statements for the three "
        "most recent years; and (e) minutes of all Member meetings. All Members shall have "
        "reasonable access to inspect and copy Company records during normal business hours upon "
        "five (5) business days' written notice.")

    pdf.section("6.3", "Bank Accounts.",
        "The Company shall maintain one or more bank accounts in the Company's name at financial "
        "institutions selected by the Managing Member. All Company funds shall be deposited in "
        "such accounts and shall not be commingled with personal funds of any Member.")

    pdf.section("6.4", "Tax Classification.",
        "The Company shall be classified as a partnership for federal income tax purposes unless "
        "the Members unanimously agree to elect otherwise. The Company shall file IRS Form 1065 "
        "and issue Schedule K-1 to each Member annually.")

    pdf.section("6.5", "Partnership Representative.",
        "Ibrahim Mohammad shall serve as the \"Partnership Representative\" (within the meaning "
        "of Section 6223 of the Internal Revenue Code, as amended by the Bipartisan Budget Act "
        "of 2015) and shall be responsible for all federal income tax filings and communications "
        "with the Internal Revenue Service on behalf of the Company. The Partnership Representative "
        "shall not take any action that would bind the other Member to a tax liability without "
        "prior written notice and consent.")

    pdf.section("6.6", "Annual Reporting.",
        "The Managing Member shall provide to all Members, within ninety (90) days of the end of "
        "each Fiscal Year: (a) an unaudited balance sheet; (b) a profit and loss statement; and "
        "(c) each Member's Schedule K-1.")

    # ── ARTICLE VII ──
    pdf.article_heading("ARTICLE VII -- TRANSFER OF MEMBERSHIP INTERESTS")

    pdf.section("7.1", "Restrictions on Transfer.",
        "No Member may Transfer all or any portion of their Membership Interest without the prior "
        "written consent of all other Members, except as otherwise provided in this Article.")

    pdf.section("7.2", "Right of First Refusal.",
        "If a Member (the \"Selling Member\") receives a bona fide written offer from a third "
        "party to purchase all or any portion of the Selling Member's Membership Interest, the "
        "Selling Member shall provide written notice to the other Member(s) (the \"Remaining "
        "Member(s)\") setting forth the material terms of the offer. The Remaining Member(s) "
        "shall have thirty (30) days from receipt of such notice to elect to purchase the offered "
        "interest on the same terms and conditions. If the Remaining Member(s) do not exercise "
        "this right, the Selling Member may complete the Transfer to the third party on terms no "
        "more favorable than those offered to the Remaining Member(s), provided the Transfer is "
        "completed within ninety (90) days.")

    pdf.section("7.3", "Tag-Along Rights.",
        "If a Member proposes to Transfer more than 50% of their Membership Interest to a third "
        "party, the non-transferring Member shall have the right (but not the obligation) to "
        "participate in the Transfer on the same terms and conditions, pro rata to their "
        "Membership Interest.")

    pdf.section("7.4", "Drag-Along Rights.",
        "If Members holding at least 75% of the total Membership Interests (after any future "
        "issuances) approve a sale of the Company or substantially all of its assets, the "
        "remaining Member(s) shall be obligated to participate in such sale on the same terms "
        "and conditions. Note: With the current 50/50 ownership structure, this provision "
        "effectively requires both Members' consent, consistent with Section 4.4(a).")

    pdf.section("7.5", "Permitted Transfers.",
        "A Member may Transfer their Membership Interest to a revocable trust, estate planning "
        "vehicle, or wholly-owned entity for the benefit of the transferring Member without "
        "triggering the Right of First Refusal, provided the transferring Member retains "
        "control of the transferee entity and provides written notice to the other Member(s) "
        "within ten (10) business days.")

    # ── ARTICLE VIII ──
    pdf.article_heading("ARTICLE VIII -- INTELLECTUAL PROPERTY")

    pdf.section("8.1", "Company IP.",
        "All intellectual property conceived, created, developed, or reduced to practice by "
        "any Member, employee, or contractor in connection with the Company's business "
        "(\"Company IP\") shall be the sole and exclusive property of the Company. Company IP "
        "includes but is not limited to: the TitraHealth mobile application and all versions "
        "thereof; source code, object code, algorithms, and databases; user interface designs, "
        "graphics, and trade dress; trademarks, service marks, and brand assets; trade secrets, "
        "know-how, and proprietary methodologies; domain names and social media accounts; and "
        "all related documentation.")

    pdf.section("8.2", "Assignment.",
        "Each Member hereby irrevocably assigns to the Company all right, title, and interest "
        "in any intellectual property created in the course of Company business, including all "
        "patent, copyright, trademark, and trade secret rights therein. Each Member agrees to "
        "execute any documents and take any actions reasonably necessary to effectuate this "
        "assignment. This is a present assignment of all future intellectual property created "
        "within the scope of Company business.")

    pdf.section("8.3", "Pre-Existing IP.",
        "Any intellectual property owned by a Member prior to the formation of the Company "
        "(\"Pre-Existing IP\") shall remain the property of that Member unless expressly "
        "assigned to the Company in writing. If Pre-Existing IP is used in Company operations, "
        "the owning Member hereby grants the Company a perpetual, royalty-free, non-exclusive "
        "license to use such Pre-Existing IP for Company purposes.")

    pdf.section("8.4", "Post-Departure.",
        "Upon a Member's withdrawal or removal, they shall have no continuing rights to the "
        "Company's intellectual property. The departing Member shall promptly return or destroy "
        "all copies of Company IP in their possession and shall certify such return or "
        "destruction in writing.")

    # ── ARTICLE IX ──
    pdf.article_heading("ARTICLE IX -- WITHDRAWAL, DEATH, AND DISSOLUTION")

    pdf.section("9.1", "Voluntary Withdrawal.",
        "A Member may withdraw from the Company upon ninety (90) days' written notice to all "
        "other Members. The withdrawing Member's Membership Interest shall be purchased by the "
        "remaining Member(s) at fair market value as determined by mutual agreement or, if the "
        "Members cannot agree within thirty (30) days, by an independent appraiser mutually "
        "selected by the Members. The cost of the appraisal shall be borne equally by the parties. "
        "Payment may be made in a lump sum or in equal monthly installments over a period not "
        "to exceed twenty-four (24) months, at the option of the purchasing Member(s).")

    pdf.section("9.2", "Death or Incapacity.",
        "Upon the death or permanent incapacity of a Member, the deceased or incapacitated "
        "Member's Membership Interest shall pass to their estate or legal representative. The "
        "remaining Member(s) shall have the option (but not the obligation) to purchase such "
        "interest at fair market value within one hundred twenty (120) days of the date of death "
        "or determination of permanent incapacity. During this period, the estate or legal "
        "representative shall have no voting rights but shall retain all economic rights.")

    pdf.section("9.3", "Dissolution.",
        "The Company shall be dissolved upon: (a) the unanimous written consent of all Members; "
        "(b) the sale of all or substantially all Company assets followed by the distribution "
        "of proceeds; (c) a judicial decree of dissolution under the Act; (d) any event that "
        "makes it unlawful for the Company to continue; or (e) the Company having no Members "
        "for a period of ninety (90) consecutive days.")

    pdf.section("9.4", "Winding Up.",
        "Upon dissolution, the Managing Member (or a liquidating agent appointed by the Members) "
        "shall wind up the Company's affairs, liquidate its assets in an orderly manner, and "
        "distribute proceeds in the following order of priority: (a) payment of debts and "
        "liabilities to third-party creditors; (b) establishment of reasonable reserves for "
        "contingent or unforeseen liabilities; (c) payment of any amounts owed to Members other "
        "than for distributions; and (d) distribution of remaining assets to Members in proportion "
        "to their positive Capital Account balances.")

    # ── ARTICLE X ──
    pdf.article_heading("ARTICLE X -- INDEMNIFICATION AND LIABILITY")

    pdf.section("10.1", "Limited Liability.",
        "No Member shall be personally liable for any debt, obligation, or liability of the "
        "Company solely by reason of being a Member, to the fullest extent permitted by the Act.")

    pdf.section("10.2", "Indemnification.",
        "The Company shall indemnify and hold harmless each Member and their affiliates, agents, "
        "and representatives (each, an \"Indemnified Person\") from and against any claims, losses, "
        "damages, liabilities, judgments, fines, penalties, costs, and expenses (including "
        "reasonable attorneys' fees) arising from actions taken or omissions made in good faith "
        "on behalf of the Company, except for acts constituting willful misconduct, gross "
        "negligence, fraud, or a material breach of this Agreement.")

    pdf.section("10.3", "Advancement of Expenses.",
        "The Company shall advance reasonable expenses (including attorneys' fees) incurred by an "
        "Indemnified Person in connection with any proceeding in advance of the final disposition "
        "of such proceeding, upon receipt of a written undertaking to repay such amounts if it is "
        "ultimately determined that the Indemnified Person is not entitled to indemnification.")

    pdf.section("10.4", "Insurance.",
        "The Company may, at its discretion, purchase and maintain directors and officers (D&O) "
        "liability insurance or other insurance to protect Members against liabilities arising "
        "from Company operations.")

    # ── ARTICLE XI ──
    pdf.article_heading("ARTICLE XI -- REPRESENTATIONS AND WARRANTIES")

    pdf.section("11.1", "Mutual Representations.",
        "Each Member represents and warrants to the other that, as of the Effective Date:")
    pdf.bullet_list([
        "(a)  They have the legal capacity and authority to enter into this Agreement;",
        "(b)  This Agreement constitutes a valid and binding obligation enforceable in accordance with its terms;",
        "(c)  Entering into this Agreement does not violate any other agreement to which they are a party;",
        "(d)  They are not subject to any non-compete or similar restriction that would prevent them from participating in the Company's business;",
        "(e)  All information provided by them to the Company or the other Member in connection with this Agreement is true, accurate, and complete.",
    ])

    # ── ARTICLE XII ──
    pdf.article_heading("ARTICLE XII -- NON-COMPETE, NON-SOLICITATION, AND CONFIDENTIALITY")

    pdf.section("12.1", "Non-Compete.",
        "During their membership and for a period of twelve (12) months following withdrawal "
        "or removal (the \"Restricted Period\"), no Member shall directly or indirectly own, "
        "manage, operate, consult for, or be employed by any business that competes with the "
        "Company's GLP-1 health tracking and titration management business within the United "
        "States, without the prior written consent of the other Member(s). This restriction "
        "shall not apply to passive ownership of less than 5% of the outstanding securities "
        "of a publicly traded company.")

    pdf.section("12.2", "Non-Solicitation.",
        "During the Restricted Period, no Member shall directly or indirectly solicit, recruit, "
        "or hire any employee, contractor, or consultant of the Company, or induce any customer, "
        "vendor, or business partner of the Company to terminate or reduce their relationship "
        "with the Company.")

    pdf.section("12.3", "Confidentiality.",
        "Each Member shall keep strictly confidential all non-public information concerning the "
        "Company's business, including but not limited to: user data and analytics; financial "
        "information, projections, and business plans; trade secrets, algorithms, and proprietary "
        "technology; customer and vendor lists and terms; and investor communications and term "
        "sheets. This obligation shall survive the termination of membership and shall continue "
        "in perpetuity. Confidential information may be disclosed only: (a) with the prior "
        "written consent of all Members; (b) as required by law, regulation, or legal process; "
        "or (c) to professional advisors bound by confidentiality obligations.")

    # ── ARTICLE XIII ──
    pdf.article_heading("ARTICLE XIII -- DISPUTE RESOLUTION")

    pdf.section("13.1", "Good-Faith Negotiation.",
        "Any dispute, controversy, or claim arising out of or relating to this Agreement shall "
        "first be addressed by good-faith negotiation between the Members for a period of "
        "fourteen (14) days from written notice of the dispute.")

    pdf.section("13.2", "Mediation.",
        "If good-faith negotiation fails, the dispute shall be submitted to mediation by a "
        "mutually agreed-upon mediator in the State of Georgia. The cost of mediation shall "
        "be shared equally by the Members. Mediation shall be completed within sixty (60) "
        "days of the mediator's appointment.")

    pdf.section("13.3", "Binding Arbitration.",
        "If mediation fails to resolve the dispute, it shall be submitted to final and binding "
        "arbitration in the State of Georgia under the Commercial Arbitration Rules of the "
        "American Arbitration Association. The arbitrator's decision shall be final and judgment "
        "may be entered in any court of competent jurisdiction. The prevailing party shall be "
        "entitled to recover reasonable attorneys' fees and costs from the non-prevailing party.")

    pdf.section("13.4", "Injunctive Relief.",
        "Notwithstanding the foregoing, either Member may seek temporary or preliminary "
        "injunctive relief from a court of competent jurisdiction to prevent irreparable harm "
        "pending the outcome of arbitration, including but not limited to enforcement of the "
        "confidentiality, non-compete, and intellectual property provisions of this Agreement.")

    pdf.section("13.5", "Governing Law.",
        "This Agreement shall be governed by and construed in accordance with the laws of the "
        "State of Georgia, without regard to its conflict-of-laws principles.")

    # ── ARTICLE XIV ──
    pdf.article_heading("ARTICLE XIV -- GENERAL PROVISIONS")

    pdf.section("14.1", "Entire Agreement.",
        "This Agreement constitutes the entire agreement among the Members with respect to "
        "the Company and supersedes all prior negotiations, representations, agreements, and "
        "understandings, whether written or oral.")

    pdf.section("14.2", "Amendments.",
        "This Agreement may be amended only by a written instrument executed by all Members.")

    pdf.section("14.3", "Severability.",
        "If any provision of this Agreement is held to be invalid, illegal, or unenforceable, "
        "the remaining provisions shall continue in full force and effect. The invalid provision "
        "shall be modified to the minimum extent necessary to make it valid and enforceable while "
        "preserving the original intent of the Members.")

    pdf.section("14.4", "Notices.",
        "All notices required or permitted under this Agreement shall be in writing and shall be "
        "deemed delivered when: (a) delivered personally; (b) sent by certified mail, return "
        "receipt requested, postage prepaid; (c) sent by nationally recognized overnight courier; "
        "or (d) sent by email with confirmed receipt. Notices shall be sent to the Members at "
        "their addresses on file with the Company.")

    pdf.section("14.5", "Counterparts.",
        "This Agreement may be executed in one or more counterparts, each of which shall be "
        "deemed an original and all of which together shall constitute one and the same instrument. "
        "Electronic signatures shall be deemed original signatures for all purposes.")

    pdf.section("14.6", "Waiver.",
        "The failure of any Member to enforce any provision of this Agreement shall not be "
        "construed as a waiver of the right to enforce that provision in the future. No waiver "
        "shall be effective unless in writing and signed by the waiving party.")

    pdf.section("14.7", "Further Assurances.",
        "Each Member agrees to execute any additional documents and take any further actions as "
        "may be reasonably necessary to carry out the purposes and intent of this Agreement.")

    pdf.section("14.8", "No Third-Party Beneficiaries.",
        "This Agreement is for the sole benefit of the Members and their permitted successors "
        "and assigns. Nothing in this Agreement shall confer any rights or remedies upon any "
        "person or entity that is not a Member.")

    # ── EXHIBIT A ──
    pdf.add_page()
    pdf.article_heading("EXHIBIT A -- INITIAL CAPITAL CONTRIBUTIONS")
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(65, 8, "  Member", border="B")
    pdf.cell(55, 8, "  Contribution", border="B")
    pdf.cell(0, 8, "  Description", border="B", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10.5)
    pdf.ln(2)
    pdf.cell(65, 8, "  Ibrahim Mohammad")
    pdf.cell(55, 8, "  $______________")
    pdf.cell(0, 8, "  ________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.cell(65, 8, "  Ray Wade")
    pdf.cell(55, 8, "  $______________")
    pdf.cell(0, 8, "  ________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 9.5)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(0, 5.5,
        "If no cash or property was contributed at formation, enter \"$0 -- Sweat Equity\" and "
        "describe the nature of each Member's non-cash contribution (e.g., software development, "
        "business strategy, design, marketing). Sweat equity contributions do not create Capital "
        "Account balances but are reflected in the Membership Interest percentages above.")

    # ── SIGNATURE PAGE ──
    pdf.add_page()
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, "SIGNATURE PAGE", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 6,
        "IN WITNESS WHEREOF, the undersigned Members have executed this Operating Agreement "
        "as of the Effective Date first written above, and each hereby acknowledges that they "
        "have read this Agreement in its entirety, understand its terms, and agree to be bound "
        "by its provisions.")

    pdf.ln(15)
    pdf.signature_block(
        "Ibrahim Mohammad",
        "Member -- 51% Voting Power, 50% Membership Interest -- Managing Member"
    )

    pdf.ln(10)
    pdf.signature_block(
        "Ray Wade",
        "Member -- 49% Voting Power, 50% Membership Interest"
    )

    pdf.ln(30)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(5)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(130, 130, 130)
    pdf.multi_cell(0, 5,
        "This Operating Agreement has been prepared for the internal use of Titra Health LLC "
        "and its Members. Each Member is encouraged to seek independent legal counsel before "
        "executing this document.")

    # ── Output ──
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "Titra_Health_LLC_Operating_Agreement.pdf")
    pdf.output(out_path)
    print(f"PDF generated: {out_path}")

if __name__ == "__main__":
    build()
