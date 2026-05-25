export type ResolutionStep = {
  id: string;
  label: string;
  detail?: string;
};

export type Track = {
  goal: string;
  sla?: string;
  warnings?: string[];
  draftAction?: string;
  owner?: string;
  whatNeeded?: string;
  status?: string;
};

export type ResolutionPlanData = {
  issueSummary: string;
  whatClydeKnows: { label: string; value: string }[];
  missingInformation: string[];
  steps: ResolutionStep[];
  customerTrack: Track;
  carrierTrack: Track;
};

type ClassificationLike = {
  category: string;
  extractedLoadNumber?: string | null;
  extractedPoNumber?: string | null;
  extractedCustomer?: string | null;
  extractedCarrier?: string | null;
  extractedEntities?: Record<string, string | null | undefined> | null;
};

type LoadLike = {
  id: string;
  loadNumber: string;
  customerName?: string | null;
  carrierName?: string | null;
  currentStatus?: string | null;
  eta?: Date | null;
  driverPhone?: string | null;
  riskLevel?: string | null;
};

type SopLike = {
  id: string;
  name: string;
  ruleText: string;
};

export function generateResolutionPlan({
  category,
  classification,
  matchedLoad,
  appliedSops,
}: {
  category: string;
  classification: ClassificationLike | null;
  matchedLoad: LoadLike | null;
  appliedSops: SopLike[];
}): ResolutionPlanData {
  // Build "What Clyde Knows"
  const knows: { label: string; value: string }[] = [];
  if (classification?.extractedLoadNumber) knows.push({ label: "Load #", value: classification.extractedLoadNumber });
  if (classification?.extractedPoNumber) knows.push({ label: "PO #", value: classification.extractedPoNumber });
  if (matchedLoad?.customerName ?? classification?.extractedCustomer) {
    knows.push({ label: "Customer", value: (matchedLoad?.customerName ?? classification?.extractedCustomer)! });
  }
  if (matchedLoad?.carrierName ?? classification?.extractedCarrier) {
    knows.push({ label: "Carrier", value: (matchedLoad?.carrierName ?? classification?.extractedCarrier)! });
  }
  if (matchedLoad?.currentStatus) knows.push({ label: "Load Status", value: matchedLoad.currentStatus });
  if (matchedLoad?.eta) {
    knows.push({ label: "ETA", value: new Date(matchedLoad.eta).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  }
  const deadline = classification?.extractedEntities?.deadline;
  if (deadline) knows.push({ label: "Customer Deadline", value: deadline });
  if (appliedSops.length) knows.push({ label: "SOPs Applied", value: `${appliedSops.length} rule${appliedSops.length > 1 ? "s" : ""}` });

  const loadRef = matchedLoad ? ` for load #${matchedLoad.loadNumber}` : "";
  const isHighRisk = matchedLoad?.riskLevel === "high" || matchedLoad?.riskLevel === "critical";

  switch (category) {
    case "status_request":
      return {
        issueSummary: `Customer requesting shipment status update${loadRef}. ETA confirmation and current location needed.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!matchedLoad ? ["Matched load — load number may be incorrect or missing"] : []),
          ...(!matchedLoad?.eta ? ["Current ETA from driver or carrier"] : []),
          ...(!matchedLoad?.currentStatus ? ["Current delivery status"] : []),
        ],
        steps: [
          { id: "1", label: "Check current load status in TMS", detail: matchedLoad ? `Load ${matchedLoad.loadNumber}: ${matchedLoad.currentStatus}` : undefined },
          { id: "2", label: "Confirm ETA with driver or carrier", detail: matchedLoad?.driverPhone ? `Driver: ${matchedLoad.driverPhone}` : undefined },
          { id: "3", label: "Approve and send Clyde's draft reply" },
          { id: "4", label: "Mark thread as sent and resolve" },
        ],
        customerTrack: {
          goal: "Receive shipment status and ETA confirmation",
          sla: "Reply within 2 hours",
          warnings: isHighRisk ? ["Load is flagged as high risk — verify details carefully"] : undefined,
          draftAction: "Send status update with current ETA",
        },
        carrierTrack: {
          goal: "Provide accurate location and ETA to broker",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Confirm current location and estimated delivery time",
          status: matchedLoad?.currentStatus ?? "Unknown",
        },
      };

    case "pod_request":
      return {
        issueSummary: `Customer requesting Proof of Delivery (POD)${loadRef}. Document must be retrieved and shared.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!matchedLoad ? ["Matched load"] : []),
          "POD document availability and retrieval status",
        ],
        steps: [
          { id: "1", label: "Confirm load has been delivered", detail: matchedLoad?.currentStatus ?? undefined },
          { id: "2", label: "Retrieve signed POD from carrier or driver portal" },
          { id: "3", label: "Attach POD and approve draft reply" },
          { id: "4", label: "Send and mark thread resolved" },
        ],
        customerTrack: {
          goal: "Receive signed POD document for their records",
          sla: "Provide POD within 24 hours of delivery",
          draftAction: "Share POD document link or attachment",
        },
        carrierTrack: {
          goal: "Confirm signed POD is available and submit it",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Signed POD from driver",
          status: matchedLoad?.currentStatus ?? "Unknown",
        },
      };

    case "bol_request":
      return {
        issueSummary: `Counterparty requesting the Bill of Lading (BOL)${loadRef}. Document should be located and provided promptly.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!matchedLoad ? ["Matched load"] : []),
          "BOL document on file in document management system",
        ],
        steps: [
          { id: "1", label: "Locate BOL in your document management system" },
          { id: "2", label: "Verify BOL details match the shipment" },
          { id: "3", label: "Attach and approve draft reply" },
          { id: "4", label: "Send and close thread" },
        ],
        customerTrack: {
          goal: "Receive BOL copy for their records or customs",
          sla: "Respond within 4 hours during business hours",
          draftAction: "Provide BOL document copy",
        },
        carrierTrack: {
          goal: "No immediate carrier action required",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "None — BOL is broker-held document",
          status: matchedLoad?.currentStatus ?? "Unknown",
        },
      };

    case "escalation":
      return {
        issueSummary: `Urgent issue requiring immediate escalation to operations lead${loadRef}. Do not draft a response without escalating first.`,
        whatClydeKnows: knows,
        missingInformation: [
          "Root cause of the complaint or issue",
          ...(!matchedLoad ? ["Matched load"] : []),
          "Specific customer expectation and resolution timeline",
        ],
        steps: [
          { id: "1", label: "Escalate to operations lead immediately", detail: "Do not draft a response before escalating" },
          { id: "2", label: "Document the issue and customer sentiment in notes" },
          { id: "3", label: "Acknowledge customer and share escalation timeline" },
          { id: "4", label: "Follow up with resolution within 1 hour" },
        ],
        customerTrack: {
          goal: "Issue resolution with accountability and transparency",
          sla: "First response within 30 minutes",
          warnings: [
            "Customer sentiment is critical — handle with care",
            ...( isHighRisk ? ["Load already flagged as high risk"] : []),
          ],
          draftAction: "Acknowledge issue and confirm escalation immediately",
        },
        carrierTrack: {
          goal: "Provide incident report and resolution timeline",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Incident report, root cause, and resolution ETA",
          status: "Under investigation",
        },
      };

    case "detention_accessorial":
      return {
        issueSummary: `Detention or accessorial charge request${loadRef}. Documentation review required before approving or disputing.`,
        whatClydeKnows: knows,
        missingInformation: [
          "Detention reason and facility timestamps",
          "Facility check-in / check-out documentation",
          ...(!matchedLoad ? ["Matched load"] : []),
        ],
        steps: [
          { id: "1", label: "Request detention documentation from carrier" },
          { id: "2", label: "Cross-reference with scheduled facility appointment time" },
          { id: "3", label: "Review SOP rules for detention approval thresholds" },
          { id: "4", label: "Approve or dispute the charge with documentation" },
          { id: "5", label: "Send response and update load notes" },
        ],
        customerTrack: {
          goal: "Transparent communication on accessorial charge status",
          sla: "Acknowledge within 4 hours",
          draftAction: "Request documentation or notify of review in progress",
        },
        carrierTrack: {
          goal: "Submit and validate detention claim with timestamps",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Check-in / check-out timestamps, reason, facility contact",
          status: "Pending documentation review",
        },
      };

    case "carrier_update":
      return {
        issueSummary: `Carrier or driver status update received${loadRef}. Log it and notify the customer if ETA or status changed.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!matchedLoad ? ["Matched load"] : []),
        ],
        steps: [
          { id: "1", label: "Log the status update in TMS" },
          { id: "2", label: "Assess if customer notification is required" },
          { id: "3", label: "Send customer update if ETA or status changed" },
          { id: "4", label: "Archive or resolve the thread" },
        ],
        customerTrack: {
          goal: "Stay informed of load progress without delay",
          draftAction: "Send proactive update if ETA or status changed",
        },
        carrierTrack: {
          goal: "Keep broker current on load status",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier",
          whatNeeded: "Confirmation that update was logged",
          status: matchedLoad?.currentStatus ?? "In Transit",
        },
      };

    case "appointment_change":
      return {
        issueSummary: `Appointment change request${loadRef}. New time must be confirmed with facility and carrier before responding.`,
        whatClydeKnows: knows,
        missingInformation: [
          classification?.extractedEntities?.appointmentTime ? undefined : "Requested new appointment date and time",
          "Facility availability for the requested new slot",
          ...(!matchedLoad ? ["Matched load"] : []),
        ].filter(Boolean) as string[],
        steps: [
          { id: "1", label: "Note the requested new appointment time", detail: classification?.extractedEntities?.appointmentTime ?? undefined },
          { id: "2", label: "Verify facility availability for the new slot" },
          { id: "3", label: "Coordinate with driver / carrier on new schedule" },
          { id: "4", label: "Send confirmation to all parties" },
        ],
        customerTrack: {
          goal: "Appointment rescheduled with minimal disruption",
          sla: "Confirm within 2 hours",
          draftAction: "Acknowledge request and confirm new appointment time",
        },
        carrierTrack: {
          goal: "Adjust schedule to meet new appointment",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier",
          whatNeeded: "Driver availability confirmation for new time slot",
          status: "Awaiting schedule update",
        },
      };

    case "rate_confirmation":
      return {
        issueSummary: `Rate confirmation requested${loadRef}. Locate and send the rate confirmation document.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!matchedLoad ? ["Matched load"] : []),
          "Rate confirmation document on file",
        ],
        steps: [
          { id: "1", label: "Locate rate confirmation in your TMS or document system" },
          { id: "2", label: "Verify rate matches agreed terms" },
          { id: "3", label: "Attach to draft reply and approve" },
          { id: "4", label: "Send and close thread" },
        ],
        customerTrack: {
          goal: "Receive signed rate confirmation for their records",
          sla: "Respond within 2 hours",
          draftAction: "Send rate confirmation document",
        },
        carrierTrack: {
          goal: "Verify rate matches load tender",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Rate agreement confirmation",
          status: matchedLoad?.currentStatus ?? "Unknown",
        },
      };

    case "billing_invoice":
      return {
        issueSummary: `Billing or invoice inquiry${loadRef}. Route to billing team and acknowledge receipt.`,
        whatClydeKnows: knows,
        missingInformation: [
          "Invoice number and amount in question",
          ...(!matchedLoad ? ["Matched load"] : []),
        ],
        steps: [
          { id: "1", label: "Identify the invoice number and amount" },
          { id: "2", label: "Route to billing team with load context" },
          { id: "3", label: "Acknowledge receipt to sender" },
          { id: "4", label: "Follow up within 24 hours with billing team status" },
        ],
        customerTrack: {
          goal: "Invoice dispute or payment inquiry resolved",
          sla: "Acknowledge within 4 hours, resolve within 2 business days",
          draftAction: "Acknowledge and route to billing",
        },
        carrierTrack: {
          goal: "Invoice processed or dispute resolved",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "Carrier TBD",
          whatNeeded: "Invoice copy and supporting documentation",
          status: "Pending billing review",
        },
      };

    case "quote_request":
      return {
        issueSummary: `Freight rate quote requested. Gather lane, equipment, and date details before responding.`,
        whatClydeKnows: knows,
        missingInformation: [
          ...(!classification?.extractedEntities?.origin ? ["Origin location"] : []),
          ...(!classification?.extractedEntities?.destination ? ["Destination location"] : []),
          "Commodity and equipment type",
          "Required pickup / delivery dates",
        ],
        steps: [
          { id: "1", label: "Confirm lane, equipment type, and dates" },
          { id: "2", label: "Check market rates and carrier availability" },
          { id: "3", label: "Prepare quote with pricing and transit time" },
          { id: "4", label: "Send quote and follow up if no response in 24 hours" },
        ],
        customerTrack: {
          goal: "Receive competitive and timely rate quote",
          sla: "Quote within 4 hours during business hours",
          draftAction: "Confirm details needed or provide quote",
        },
        carrierTrack: {
          goal: "Carrier capacity sourcing (if quoting)",
          owner: "Open — carrier not yet assigned",
          whatNeeded: "Carrier availability and rate for the lane",
          status: "Not started",
        },
      };

    default:
      return {
        issueSummary: `Email requires manual review${loadRef}. Category: ${category.replace(/_/g, " ")}.`,
        whatClydeKnows: knows,
        missingInformation: [
          "Specific request or issue details",
          ...(!matchedLoad ? ["Matched load"] : []),
        ],
        steps: [
          { id: "1", label: "Read email and understand the request" },
          { id: "2", label: "Classify or re-classify if category looks wrong" },
          { id: "3", label: "Generate and approve a draft reply" },
          { id: "4", label: "Send and resolve" },
        ],
        customerTrack: {
          goal: "Prompt and accurate response",
          sla: "Reply within 4 hours",
          draftAction: "Respond to the specific request",
        },
        carrierTrack: {
          goal: "No action required unless load-related",
          owner: matchedLoad?.carrierName ?? classification?.extractedCarrier ?? "N/A",
          whatNeeded: "Depends on the email category",
          status: matchedLoad?.currentStatus ?? "Unknown",
        },
      };
  }
}
