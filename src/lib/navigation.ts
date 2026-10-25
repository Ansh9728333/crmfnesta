export const modules = [
  {
    slug: "help-tickets",
    title: "Help Tickets",
    group: "Workspace",
    description: "Customer concerns from enquiry through service.",
    empty: "Keep every concern connected",
    detail: "Raise, resolve and confirm customer help requests.",
  },
  {
    slug: "service",
    title: "Customer service",
    group: "Operations",
    description: "Feedback, complaints and service requests after handover.",
    empty: "Customer care",
    detail: "Assigned service tickets and complaint resolution.",
  },
  {
    slug: "projects",
    title: "Projects",
    group: "Workspace",
    description: "Connect every site to its customer and opportunities.",
    empty: "A place for every project",
    detail: "Project records and customer relationships.",
  },
  {
    slug: "leads",
    title: "Leads",
    group: "Workspace",
    description: "Capture enquiries and move every opportunity forward.",
    empty: "Your next customer starts here",
    detail:
      "Lead capture, assignment and the shared seven-stage pre-sales workflow will be available after the database and access controls are connected.",
  },
  {
    slug: "customers",
    title: "Customers",
    group: "Workspace",
    description: "A single place for every customer relationship.",
    empty: "Make room for lasting relationships",
    detail:
      "Customer profiles, contact details and linked opportunities will appear here when customer management is implemented.",
  },
  {
    slug: "appointments",
    title: "Appointments",
    group: "Workspace",
    description: "Keep site visits, showroom visits and surveys in sync.",
    empty: "A clear schedule, from the first visit",
    detail:
      "Site visits, initial measurements and final survey appointments will be managed here in a later phase.",
  },
  {
    slug: "quotations",
    title: "Quotations",
    group: "Workspace",
    description: "Bring clarity to proposals and every revision.",
    empty: "Build confidence with every quotation",
    detail:
      "Versioned quotations, negotiation history and won or lost outcomes will be connected to leads here.",
  },
  {
    slug: "orders",
    title: "Orders",
    group: "Operations",
    description: "Follow every commitment from win to handover.",
    empty: "Every order, thoughtfully delivered",
    detail:
      "Won orders will follow the shared sixteen-stage post-sales workflow, with documents, milestones and an auditable activity history.",
  },
  {
    slug: "payments",
    title: "Payments",
    group: "Operations",
    description: "Manage installments and verified payment milestones.",
    empty: "Payment ledger",
    detail: "Verified receipts and load-wise milestone allocations.",
  },
  {
    slug: "dispatch",
    title: "Dispatch & delivery",
    group: "Operations",
    description: "Approve shipments and confirm site receipts.",
    empty: "Material movement",
    detail: "Track challans, transport and partial deliveries.",
  },
  {
    slug: "production",
    title: "Production loads",
    group: "Operations",
    description: "Coordinate one load or many within each order.",
    empty: "Plan each load with confidence",
    detail:
      "All three companies support multiple production loads. Planning, factory readiness and delivery progress will remain linked to the parent order.",
  },
  {
    slug: "installations",
    title: "Installations",
    group: "Operations",
    description: "Connect delivery, installation and quality on site.",
    empty: "Finish every site with care",
    detail:
      "Installation progress, service engineer audits and handover will live here. S-Grip glass activities stay within the existing order.",
  },
  {
    slug: "documents",
    title: "Documents",
    group: "Operations",
    description: "Keep drawings, measurements and project files together.",
    empty: "The right document, in the right hands",
    detail:
      "Private Supabase Storage and company-scoped access policies will be implemented before uploads and downloads are enabled.",
  },
  {
    slug: "reports",
    title: "Reports",
    group: "Insights",
    description: "Turn your customer journey into actionable insights.",
    empty: "Real decisions start with real data",
    detail:
      "Conversion, pipeline and delivery reports will be built from persisted CRM records. No sample metrics are shown.",
  },
  {
    slug: "settings",
    title: "Settings",
    group: "Insights",
    description: "A considered foundation for your team and companies.",
    empty: "Your workspace is taking shape",
    detail:
      "Authorized administrators manage employee accounts, organization assignments and role permissions in Employee Management. Business settings will be expanded in a later phase.",
  },
] as const;

export type ModuleSlug = (typeof modules)[number]["slug"];
