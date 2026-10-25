export const companies = [
  { id: "finesta-home", name: "Finesta Home", product: "Windows", initials: "FH" },
  { id: "ibax", name: "IBAX", product: "Shower Partitions", initials: "IB" },
  { id: "s-grip", name: "S-Grip", product: "Railings", initials: "SG" },
] as const;

export const preSalesStages = [
  "Lead Generated",
  "Site Visit Appointment",
  "Site Visit and Initial Measurement",
  "Quotation Submitted",
  "Customer Showroom Visit",
  "Negotiation / Quotation Revision",
  "Order Won or Lost",
] as const;

export const postSalesStages = [
  "WhatsApp Group Created",
  "Documents Uploaded",
  "Final Survey Appointment",
  "Final Survey and Measurement",
  "Site Readiness Confirmed",
  "Production Load Planning",
  "Production Order Released",
  "Factory Production and Readiness",
  "Customer Payment Received",
  "Material Dispatched",
  "Material Delivered",
  "Installation Started",
  "Installation Completed",
  "Service Engineer Audit",
  "Site Handover",
  "Testimonial and Google Review",
] as const;

export const glassActivities = [
  "Glass Measurement Taken",
  "Glass Template Prepared",
  "Glass Template Approved",
] as const;
