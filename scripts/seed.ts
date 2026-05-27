import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const DEMO_SLUG = "harbor-freight-demo";

async function main() {
  console.log("🌱 Seeding Clyde demo data...");

  // Wipe existing demo tenant
  const existing = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, DEMO_SLUG));
  if (existing.length > 0) {
    await db.delete(schema.tenants).where(eq(schema.tenants.slug, DEMO_SLUG));
    console.log("  Cleared existing demo tenant");
  }

  // Tenant
  const [tenant] = await db.insert(schema.tenants).values({
    name: "Harbor Freight Brokerage",
    slug: DEMO_SLUG,
  }).returning();
  console.log(`  Tenant: ${tenant.id}`);

  // Users
  const [u1, u2, u3, u4] = await db.insert(schema.users).values([
    { tenantId: tenant.id, name: "Marcus Webb", email: "marcus@harborfreight.demo", role: "admin" },
    { tenantId: tenant.id, name: "Danielle Torres", email: "danielle@harborfreight.demo", role: "agent" },
    { tenantId: tenant.id, name: "Ray Okafor", email: "ray@harborfreight.demo", role: "agent" },
    { tenantId: tenant.id, name: "Priya Nair", email: "priya@harborfreight.demo", role: "viewer" },
  ]).returning();

  // Inbox
  const [inbox] = await db.insert(schema.inboxes).values({
    tenantId: tenant.id,
    name: "Ops Shared Inbox",
    emailAddress: "ops@harborfreight.demo",
    provider: "gmail",
  }).returning();

  // SOP Rules
  await db.insert(schema.sopRules).values([
    { tenantId: tenant.id, name: "Never auto-send detention replies", category: "detention_accessorial", ruleText: "Never auto-send detention or accessorial replies. Always require human approval. Do not admit fault or approve charges in the draft.", requireApproval: true, isActive: true },
    { tenantId: tenant.id, name: "Escalations go to lead", category: "escalation", ruleText: "Route all escalation emails to the operations lead immediately. Keep the draft calm. Do not over-commit on resolution timelines.", requireApproval: true, isActive: true },
    { tenantId: tenant.id, name: "POD not available = pending", category: "pod_request", ruleText: "If the POD is not yet retrieved, say it is pending retrieval from the carrier. Never say it is attached if it is not.", requireApproval: false, isActive: true },
    { tenantId: tenant.id, name: "Stale tracking disclaimer", category: "status_request", ruleText: "If tracking has not updated in more than 4 hours, say the team is confirming status with the carrier directly. Do not guess at location.", requireApproval: false, isActive: true },
    { tenantId: tenant.id, name: "Include load number in all status replies", category: "status_request", ruleText: "Always reference the load number when replying to status requests. If no load number is matched, ask the customer to confirm.", requireApproval: false, isActive: true },
    { tenantId: tenant.id, name: "Quote replies: confirm lane + equipment", category: "quote_request", ruleText: "Before providing a quote, confirm: origin, destination, pickup date, equipment type, and any special requirements. Do not quote blind.", requireApproval: true, isActive: true },
    { tenantId: tenant.id, name: "Do not reveal carrier rate", category: "billing_invoice", ruleText: "Never reveal the carrier rate or margin in customer communications. Route billing disputes to the billing team.", requireApproval: true, isActive: true },
    { tenantId: tenant.id, name: "After-hours: acknowledge receipt", category: "unknown", ruleText: "After 6pm and before 8am, acknowledge receipt of the email and provide estimated response time of next business morning.", requireApproval: false, isActive: true },
  ]);

  // Loads
  const now = new Date();
  const d = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86400000);

  const loadsData = [
    { loadNumber: "HFB-3421", poNumber: "PO-88291", customerName: "Acme Foods Inc", carrierName: "Titan Trucking", originCity: "Dallas", originState: "TX", destinationCity: "Atlanta", destinationState: "GA", pickupAt: d(-1), deliveryAt: d(1), currentStatus: "In Transit", eta: d(1), driverName: "James Polk", driverPhone: "214-555-0192", equipmentType: "Reefer 53'", rate: "2800.00", riskLevel: "high", internalNotes: "Driver delayed 2hr due to weather. Customer has been notified once." },
    { loadNumber: "HFB-3422", poNumber: "PO-88305", customerName: "Gulf Coast Steel", carrierName: "Redline Express", originCity: "Houston", originState: "TX", destinationCity: "Memphis", destinationState: "TN", pickupAt: d(-2), deliveryAt: d(0), currentStatus: "Delivered - POD Pending", eta: d(0), driverName: "Maria Santos", driverPhone: "713-555-0441", equipmentType: "Flatbed 48'", rate: "3100.00", riskLevel: "medium", internalNotes: "Delivered. Waiting on POD from carrier." },
    { loadNumber: "HFB-3423", poNumber: "PO-88310", customerName: "Midwest Auto Parts", carrierName: "Arrow Logistics", originCity: "Detroit", originState: "MI", destinationCity: "Nashville", destinationState: "TN", pickupAt: d(0), deliveryAt: d(2), currentStatus: "At Pickup", eta: d(2), driverName: "Carlos Reyes", driverPhone: "313-555-0882", equipmentType: "Dry Van 53'", rate: "1950.00", riskLevel: "low", internalNotes: null },
    { loadNumber: "HFB-3424", poNumber: "PO-88320", customerName: "Pacific Retail Co", carrierName: "Blue Ridge Transport", originCity: "Los Angeles", originState: "CA", destinationCity: "Phoenix", destinationState: "AZ", pickupAt: d(-3), deliveryAt: d(-1), currentStatus: "Delivered", eta: d(-1), driverName: "Tom Bradley", driverPhone: "323-555-0103", equipmentType: "Dry Van 53'", rate: "1400.00", riskLevel: "low", internalNotes: "Clean delivery." },
    { loadNumber: "HFB-3425", poNumber: "PO-88334", customerName: "Acme Foods Inc", carrierName: "NorthStar Carriers", originCity: "Chicago", originState: "IL", destinationCity: "Kansas City", destinationState: "MO", pickupAt: d(1), deliveryAt: d(3), currentStatus: "Booked", eta: d(3), driverName: "Linda Park", driverPhone: "312-555-0774", equipmentType: "Reefer 53'", rate: "2200.00", riskLevel: "low", internalNotes: null },
    { loadNumber: "HFB-3426", poNumber: "PO-88341", customerName: "Southeast Lumber", carrierName: "Titan Trucking", originCity: "Charlotte", originState: "NC", destinationCity: "Miami", destinationState: "FL", pickupAt: d(-1), deliveryAt: d(1), currentStatus: "Delayed", eta: d(2), driverName: "Dwayne Ellis", driverPhone: "704-555-0210", equipmentType: "Flatbed 48'", rate: "3600.00", riskLevel: "high", internalNotes: "Driver mechanical issue. ETA pushed 24hr. Consignee notified." },
    { loadNumber: "HFB-3427", poNumber: "PO-88358", customerName: "Gulf Coast Steel", carrierName: "Atlas Freight", originCity: "Birmingham", originState: "AL", destinationCity: "New Orleans", destinationState: "LA", pickupAt: d(0), deliveryAt: d(1), currentStatus: "In Transit", eta: d(1), driverName: "Angela Moore", driverPhone: "205-555-0398", equipmentType: "Flatbed 48'", rate: "1750.00", riskLevel: "low", internalNotes: null },
    { loadNumber: "HFB-3428", poNumber: "PO-88372", customerName: "Midwest Auto Parts", carrierName: "FastLane Inc", originCity: "Indianapolis", originState: "IN", destinationCity: "St. Louis", destinationState: "MO", pickupAt: d(-4), deliveryAt: d(-2), currentStatus: "Exception", eta: null, driverName: "Kevin Hart", driverPhone: "317-555-0655", equipmentType: "Dry Van 48'", rate: "1100.00", riskLevel: "high", internalNotes: "Load rejected at consignee. Reason unclear. Carrier in contact." },
    { loadNumber: "HFB-3429", poNumber: "PO-88389", customerName: "Pacific Retail Co", carrierName: "Redline Express", originCity: "Seattle", originState: "WA", destinationCity: "Denver", destinationState: "CO", pickupAt: d(2), deliveryAt: d(4), currentStatus: "Booked", eta: d(4), driverName: null, driverPhone: null, equipmentType: "Dry Van 53'", rate: "2700.00", riskLevel: "low", internalNotes: "Driver assignment pending." },
    { loadNumber: "HFB-3430", poNumber: "PO-88401", customerName: "Southeast Lumber", carrierName: "Blue Ridge Transport", originCity: "Savannah", originState: "GA", destinationCity: "Richmond", destinationState: "VA", pickupAt: d(-2), deliveryAt: d(0), currentStatus: "In Transit", eta: d(0), driverName: "Rosa Kim", driverPhone: "912-555-0117", equipmentType: "Flatbed 48'", rate: "2100.00", riskLevel: "medium", internalNotes: "Tracking stale since this morning." },
  ];

  const insertedLoads = await db.insert(schema.loads).values(loadsData.map((l) => ({ tenantId: tenant.id, ...l }))).returning();
  const loadMap = Object.fromEntries(insertedLoads.map((l) => [l.loadNumber, l]));

  // Documents for delivered loads
  await db.insert(schema.loadDocuments).values([
    { tenantId: tenant.id, loadId: loadMap["HFB-3424"].id, documentType: "POD", fileName: "POD_HFB3424.pdf", fileUrl: "/mock/docs/POD_HFB3424.pdf" },
    { tenantId: tenant.id, loadId: loadMap["HFB-3424"].id, documentType: "BOL", fileName: "BOL_HFB3424.pdf", fileUrl: "/mock/docs/BOL_HFB3424.pdf" },
    { tenantId: tenant.id, loadId: loadMap["HFB-3422"].id, documentType: "BOL", fileName: "BOL_HFB3422.pdf", fileUrl: "/mock/docs/BOL_HFB3422.pdf" },
  ]);

  // Email threads + messages
  type ThreadSeed = { subject: string; customerName?: string; carrierName?: string; status: typeof schema.threadStatusEnum.enumValues[number]; priority: typeof schema.threadPriorityEnum.enumValues[number]; loadNumber?: string; messages: { direction: typeof schema.messageDirectionEnum.enumValues[number]; senderName: string; senderEmail: string; recipientEmail: string; body: string; hoursAgo: number }[] };

  const threads: ThreadSeed[] = [
    {
      subject: "ETA update on HFB-3421 — Acme Foods",
      customerName: "Acme Foods Inc",
      status: "open",
      priority: "high",
      loadNumber: "HFB-3421",
      messages: [
        { direction: "inbound", senderName: "Sarah Chen", senderEmail: "schen@acmefoods.com", recipientEmail: "ops@harborfreight.demo", body: "Hi, can you give me an update on load HFB-3421? The driver was supposed to arrive at our Atlanta DC at 2pm and it's already 4pm. Our receiving team is still here but we need to know if we should keep them. Thanks.", hoursAgo: 2 },
      ],
    },
    {
      subject: "POD needed — HFB-3422",
      customerName: "Gulf Coast Steel",
      status: "open",
      priority: "normal",
      loadNumber: "HFB-3422",
      messages: [
        { direction: "inbound", senderName: "Tom Garrett", senderEmail: "tgarrett@gulfsteel.com", recipientEmail: "ops@harborfreight.demo", body: "Hello, load HFB-3422 was delivered yesterday but we still haven't received the POD. Can you please send it over? Our AP team needs it to process payment.", hoursAgo: 18 },
      ],
    },
    {
      subject: "Detention request — HFB-3421 Dallas pickup",
      carrierName: "Titan Trucking",
      status: "pending_review",
      priority: "high",
      loadNumber: "HFB-3421",
      messages: [
        { direction: "inbound", senderName: "Dispatch - Titan Trucking", senderEmail: "dispatch@titantrucking.com", recipientEmail: "ops@harborfreight.demo", body: "Our driver James Polk was at the Dallas shipper for 4.5 hours waiting to get loaded. Per our contract, anything over 2 hours is billable detention. Please confirm you will approve $350 detention on load HFB-3421.", hoursAgo: 6 },
      ],
    },
    {
      subject: "Quote request — Chicago to Denver, 44k lbs dry van",
      customerName: "Pacific Retail Co",
      status: "open",
      priority: "normal",
      messages: [
        { direction: "inbound", senderName: "Mike Larson", senderEmail: "mlarson@pacificretail.com", recipientEmail: "ops@harborfreight.demo", body: "Hi Harbor Freight team — we have a recurring lane we need covered. Chicago IL to Denver CO, 44,000 lbs, dry van 53'. Pickup would be this Thursday. Can you get us a rate? We typically move 2-3 loads per week on this lane.", hoursAgo: 4 },
      ],
    },
    {
      subject: "URGENT — load rejected at consignee HFB-3428",
      customerName: "Midwest Auto Parts",
      status: "escalated",
      priority: "urgent",
      loadNumber: "HFB-3428",
      messages: [
        { direction: "inbound", senderName: "Greg Nelson", senderEmail: "gnelson@midwestauto.com", recipientEmail: "ops@harborfreight.demo", body: "This is absolutely unacceptable. Load HFB-3428 was rejected at our St. Louis facility because the freight was improperly packaged and showed signs of damage. Your carrier FastLane caused this. We have a production line shut down because of this. I need someone from management to call me NOW. We are going to hold you responsible for damages.", hoursAgo: 1 },
        { direction: "outbound", senderName: "Danielle Torres", senderEmail: "danielle@harborfreight.demo", recipientEmail: "gnelson@midwestauto.com", body: "Mr. Nelson — I understand the urgency. Our operations lead Marcus Webb is being looped in now and will call you within 15 minutes. We take this situation very seriously and are investigating immediately.", hoursAgo: 0.5 },
      ],
    },
    {
      subject: "Appointment reschedule — HFB-3426 delivery",
      customerName: "Southeast Lumber",
      status: "open",
      priority: "high",
      loadNumber: "HFB-3426",
      messages: [
        { direction: "inbound", senderName: "Purchasing - Southeast Lumber", senderEmail: "purchasing@selumber.com", recipientEmail: "ops@harborfreight.demo", body: "We received notice that load HFB-3426 is delayed. Our original delivery appointment was Thursday 8am. We need to reschedule to Friday between 10am-2pm. Please confirm the carrier can accommodate and update us on the new ETA.", hoursAgo: 3 },
      ],
    },
    {
      subject: "Invoice question — HFB-3424 fuel surcharge",
      customerName: "Pacific Retail Co",
      status: "open",
      priority: "low",
      loadNumber: "HFB-3424",
      messages: [
        { direction: "inbound", senderName: "AP Team", senderEmail: "ap@pacificretail.com", recipientEmail: "ops@harborfreight.demo", body: "Hi, we received your invoice for load HFB-3424 and have a question about the fuel surcharge line item. The invoice shows $187 FSC but our agreed rate sheet shows a different calculation. Can you provide the FSC breakdown and how it was calculated?", hoursAgo: 26 },
      ],
    },
    {
      subject: "Driver check call — HFB-3427 in transit",
      carrierName: "Atlas Freight",
      status: "resolved",
      priority: "low",
      loadNumber: "HFB-3427",
      messages: [
        { direction: "inbound", senderName: "Angela Moore", senderEmail: "amoore@atlasfreight.com", recipientEmail: "ops@harborfreight.demo", body: "Check call for load HFB-3427. Currently at mile marker 142 on I-10 westbound. On track for delivery tomorrow morning around 9am. No issues to report. Freight is secure.", hoursAgo: 5 },
        { direction: "outbound", senderName: "Ray Okafor", senderEmail: "ray@harborfreight.demo", recipientEmail: "amoore@atlasfreight.com", body: "Thanks Angela. Logged. Please send another check call when you cross into Louisiana and again when you are 2 hours out from New Orleans.", hoursAgo: 4.5 },
      ],
    },
    {
      subject: "BOL request — HFB-3423",
      customerName: "Midwest Auto Parts",
      status: "open",
      priority: "normal",
      loadNumber: "HFB-3423",
      messages: [
        { direction: "inbound", senderName: "Receiving - Midwest Auto", senderEmail: "receiving@midwestauto.com", recipientEmail: "ops@harborfreight.demo", body: "Can you please send over the BOL for load HFB-3423? We need it for our receiving records before the truck arrives tomorrow.", hoursAgo: 8 },
      ],
    },
    {
      subject: "Will load HFB-3430 deliver today?",
      customerName: "Southeast Lumber",
      status: "open",
      priority: "high",
      loadNumber: "HFB-3430",
      messages: [
        { direction: "inbound", senderName: "Yard Manager", senderEmail: "yard@selumber.com", recipientEmail: "ops@harborfreight.demo", body: "Hi — load HFB-3430 was scheduled for today but we haven't heard anything and tracking hasn't updated since early this morning. Is this load still going to deliver today? We have a crew scheduled to unload and need to know if we should keep them.", hoursAgo: 1.5 },
      ],
    },
    {
      subject: "After-hours inquiry — load status HFB-3425",
      customerName: "Acme Foods Inc",
      status: "open",
      priority: "normal",
      loadNumber: "HFB-3425",
      messages: [
        { direction: "inbound", senderName: "Night Ops - Acme Foods", senderEmail: "nightops@acmefoods.com", recipientEmail: "ops@harborfreight.demo", body: "This is Acme Foods night operations. Can you confirm the status of HFB-3425? It's booked for tomorrow pickup and we want to make sure everything is confirmed on the carrier side before our shift ends.", hoursAgo: 0.25 },
      ],
    },
    {
      subject: "Rate confirmation needed — HFB-3429",
      carrierName: "Redline Express",
      status: "open",
      priority: "normal",
      loadNumber: "HFB-3429",
      messages: [
        { direction: "inbound", senderName: "Ops - Redline Express", senderEmail: "ops@redlineexpress.com", recipientEmail: "ops@harborfreight.demo", body: "Hi Harbor Freight — we have load HFB-3429 in our system as booked but have not received the rate confirmation yet. Can you please send it over so we can assign a driver? Pickup is in 2 days.", hoursAgo: 7 },
      ],
    },
    {
      subject: "Tracking stale on HFB-3430 — concern",
      customerName: "Southeast Lumber",
      status: "open",
      priority: "high",
      loadNumber: "HFB-3430",
      messages: [
        { direction: "inbound", senderName: "Logistics Mgr - SE Lumber", senderEmail: "logistics@selumber.com", recipientEmail: "ops@harborfreight.demo", body: "Second email on this — tracking for HFB-3430 has not updated since 7:42am. It is now 2pm. This load should be delivering in Richmond today. I need an actual status update, not an auto-reply.", hoursAgo: 1 },
      ],
    },
    {
      subject: "New quote — Dallas to Chicago, temp controlled",
      customerName: "Acme Foods Inc",
      status: "open",
      priority: "normal",
      messages: [
        { direction: "inbound", senderName: "Procurement - Acme Foods", senderEmail: "procurement@acmefoods.com", recipientEmail: "ops@harborfreight.demo", body: "Hi team, need a quote for a reefer load. Dallas TX to Chicago IL, approximately 36,000 lbs, temp set at 34°F. Commodity is fresh produce. Pickup needed next Monday. This would be a weekly recurring lane if rates are competitive.", hoursAgo: 12 },
      ],
    },
    {
      subject: "Lumper receipt — HFB-3422 Memphis delivery",
      carrierName: "Redline Express",
      status: "open",
      priority: "low",
      loadNumber: "HFB-3422",
      messages: [
        { direction: "inbound", senderName: "Driver - Maria Santos", senderEmail: "msantos@redlineexpress.com", recipientEmail: "ops@harborfreight.demo", body: "Attached is the lumper receipt for HFB-3422 at Memphis. Cost was $225. Please advance this to me or let me know how it will be processed. Thanks.", hoursAgo: 20 },
      ],
    },

    // --- NEW RICH SCENARIOS ---

    {
      subject: "POD attached — HFB-3422 Memphis delivery",
      carrierName: "Redline Express",
      status: "resolved",
      priority: "normal",
      loadNumber: "HFB-3422",
      messages: [
        { direction: "inbound", senderName: "Dispatch - Redline Express", senderEmail: "dispatch@redlineexpress.com", recipientEmail: "ops@harborfreight.demo", body: "Hi Harbor Freight team,\n\nPlease find attached the signed POD for load HFB-3422. Delivered to Memphis yesterday at 11:42 AM. Consignee signed without exceptions.\n\nAttachments:\n- POD_HFB3422_signed.pdf\n\nLet us know if you need anything else.", hoursAgo: 16 },
        { direction: "outbound", senderName: "Ray Okafor", senderEmail: "ray@harborfreight.demo", recipientEmail: "dispatch@redlineexpress.com", body: "Got it — thank you Maria. POD received and logged. Great work on this load.", hoursAgo: 15 },
      ],
    },

    {
      subject: "Driver not responding — HFB-3430",
      carrierName: "Blue Ridge Transport",
      status: "escalated",
      priority: "urgent",
      loadNumber: "HFB-3430",
      messages: [
        { direction: "inbound", senderName: "Yard Manager - SE Lumber", senderEmail: "yard@selumber.com", recipientEmail: "ops@harborfreight.demo", body: "It is now 4:30pm and the driver for HFB-3430 still has not arrived. We cannot reach the driver on the number you provided. Our receiving dock closes at 6pm and we will NOT be available after hours. If this truck is not here by 5:30pm we are refusing the delivery and you will be responsible for redelivery costs.", hoursAgo: 0.5 },
        { direction: "inbound", senderName: "Rosa Kim", senderEmail: "rkim@blueridgetransport.com", recipientEmail: "ops@harborfreight.demo", body: "Hi — this is Rosa, driver on HFB-3430. My GPS took me to the wrong gate. I am at the facility but the guard is not letting me in. Someone from the consignee needs to authorize me at Gate 4.", hoursAgo: 0.25 },
      ],
    },

    {
      subject: "Rate confirmation request — HFB-3429 Seattle to Denver",
      carrierName: "Redline Express",
      status: "open",
      priority: "normal",
      loadNumber: "HFB-3429",
      messages: [
        { direction: "outbound", senderName: "Danielle Torres", senderEmail: "danielle@harborfreight.demo", recipientEmail: "ops@redlineexpress.com", body: "Hi Redline team,\n\nPlease find the rate confirmation attached for load HFB-3429:\n\n- Lane: Seattle, WA → Denver, CO\n- Equipment: Dry Van 53'\n- Rate: $2,700 all-in\n- Pickup: Thursday\n\nPlease sign and return. Driver assignment needed by tomorrow EOD.", hoursAgo: 6 },
        { direction: "inbound", senderName: "Ops - Redline Express", senderEmail: "ops@redlineexpress.com", recipientEmail: "ops@harborfreight.demo", body: "Rate con received. Signed and attached — HFB-3429_ratecon_signed.pdf. Driver assigned: Tony Wu, cell 206-555-0317. He will confirm pickup time tomorrow morning.", hoursAgo: 4 },
      ],
    },

    {
      subject: "Damage claim — HFB-3428 freight improperly loaded",
      customerName: "Midwest Auto Parts",
      status: "escalated",
      priority: "urgent",
      loadNumber: "HFB-3428",
      messages: [
        { direction: "inbound", senderName: "Greg Nelson", senderEmail: "gnelson@midwestauto.com", recipientEmail: "ops@harborfreight.demo", body: "Following up on the rejected load HFB-3428. We have completed our inspection and the damage is significant. 14 pallets of transmission components are a total loss due to improper blocking and bracing by the carrier. I am attaching photos (damage_hfb3428_001.jpg through 005.jpg).\n\nEstimated loss: $47,000. We are initiating a formal freight claim and will be withholding payment of your invoice until resolved. Please provide your cargo insurance certificate and claim contact immediately.", hoursAgo: 3 },
        { direction: "outbound", senderName: "Marcus Webb", senderEmail: "marcus@harborfreight.demo", recipientEmail: "gnelson@midwestauto.com", body: "Mr. Nelson,\n\nI've received your documentation and I understand the severity. I am opening a formal claim with FastLane Inc's cargo insurer today. Claim reference will be provided within 2 hours.\n\nOur cargo insurance certificate is attached. I will be your direct contact throughout this process.\n\nMarcus Webb\nOperations Lead, Harbor Freight Brokerage\n214-555-0001", hoursAgo: 2.5 },
        { direction: "inbound", senderName: "Greg Nelson", senderEmail: "gnelson@midwestauto.com", recipientEmail: "ops@harborfreight.demo", body: "Thank you Marcus. Awaiting the claim reference number. Our production line is at a standstill — any way to expedite a replacement load from our supplier in Indianapolis? Same spec, same route.", hoursAgo: 2 },
      ],
    },

    {
      subject: "Carrier insurance expiring — FastLane Inc",
      carrierName: "FastLane Inc",
      status: "open",
      priority: "high",
      messages: [
        { direction: "inbound", senderName: "Compliance - FastLane Inc", senderEmail: "compliance@fastlaneinc.com", recipientEmail: "ops@harborfreight.demo", body: "Hi Harbor Freight,\n\nOur cargo insurance renewed this week. Please find the updated certificate of insurance attached (COI_FastLane_2026.pdf). The new policy is effective 5/20/2026 and runs through 5/19/2027.\n\nPlease update your records. Let us know if your compliance team needs anything else.", hoursAgo: 48 },
        { direction: "outbound", senderName: "Danielle Torres", senderEmail: "danielle@harborfreight.demo", recipientEmail: "compliance@fastlaneinc.com", body: "Hi FastLane,\n\nThank you — we have received and logged the updated COI. Your carrier profile is now current through May 2027.\n\nDanielle\nHarbor Freight Brokerage", hoursAgo: 46 },
      ],
    },

    {
      subject: "New lane inquiry — weekly reefer Chicago to Dallas",
      customerName: "Acme Foods Inc",
      status: "open",
      priority: "normal",
      messages: [
        { direction: "inbound", senderName: "Procurement - Acme Foods", senderEmail: "procurement@acmefoods.com", recipientEmail: "ops@harborfreight.demo", body: "Hi,\n\nWe are looking to add a new weekly lane: Chicago IL to Dallas TX, reefer, approximately 40,000 lbs. Commodity is frozen meals, temp set at 0°F. We'd need 2 loads per week with pickups on Tuesdays and Fridays.\n\nWe currently use two other brokers for this lane. Can Harbor Freight be competitive? Looking for a rate to compare.", hoursAgo: 10 },
      ],
    },

    {
      subject: "Appointment confirmed — HFB-3426 Friday 11am",
      customerName: "Southeast Lumber",
      status: "resolved",
      priority: "normal",
      loadNumber: "HFB-3426",
      messages: [
        { direction: "outbound", senderName: "Danielle Torres", senderEmail: "danielle@harborfreight.demo", recipientEmail: "purchasing@selumber.com", body: "Hi SE Lumber team,\n\nI've confirmed with Titan Trucking — the driver can accommodate your requested Friday 10am–2pm window for HFB-3426. New appointment is Friday, 11:00 AM delivery. ETA has been updated accordingly.\n\nDriver Dwayne Ellis will call 30 minutes before arrival.\n\nThanks for your flexibility.\n\nDanielle\nHarbor Freight Brokerage", hoursAgo: 1.5 },
        { direction: "inbound", senderName: "Purchasing - Southeast Lumber", senderEmail: "purchasing@selumber.com", recipientEmail: "ops@harborfreight.demo", body: "Perfect — Friday 11am works. We're all set on our end. Thanks for the quick turnaround.", hoursAgo: 1 },
      ],
    },

    {
      subject: "Check call — HFB-3421 Dallas in transit",
      carrierName: "Titan Trucking",
      status: "resolved",
      priority: "normal",
      loadNumber: "HFB-3421",
      messages: [
        { direction: "inbound", senderName: "James Polk", senderEmail: "jpolk@titantrucking.com", recipientEmail: "ops@harborfreight.demo", body: "Check call — HFB-3421. Currently I-20 eastbound near Shreveport, LA. Running about 90 minutes behind due to traffic slowdown. New ETA Atlanta delivery ~5:30pm instead of 2pm. Freight is secure and reefer is holding temp at 36°F.", hoursAgo: 3 },
        { direction: "outbound", senderName: "Ray Okafor", senderEmail: "ray@harborfreight.demo", recipientEmail: "jpolk@titantrucking.com", body: "James — got it, logged. I'll notify the customer. Please send another check call when you cross into Alabama.", hoursAgo: 2.8 },
        { direction: "inbound", senderName: "James Polk", senderEmail: "jpolk@titantrucking.com", recipientEmail: "ops@harborfreight.demo", body: "Crossed into Alabama. On track now — ETA still 5:30pm Atlanta. Traffic cleared up.", hoursAgo: 1 },
      ],
    },

    {
      subject: "Double-broker concern — load HFB-3427",
      carrierName: "Atlas Freight",
      status: "pending_review",
      priority: "high",
      loadNumber: "HFB-3427",
      messages: [
        { direction: "inbound", senderName: "Ops - Atlas Freight", senderEmail: "ops@atlasfreight.com", recipientEmail: "ops@harborfreight.demo", body: "Hi Harbor Freight. We need to re-broker load HFB-3427 to one of our partner carriers due to a truck breakdown. We'd move it to Southern Star Transport, MC# 987654. Is this acceptable? We can have a replacement truck there within 3 hours.", hoursAgo: 2 },
      ],
    },

    {
      subject: "Invoice — HFB-3422 final billing",
      carrierName: "Redline Express",
      status: "open",
      priority: "low",
      loadNumber: "HFB-3422",
      messages: [
        { direction: "inbound", senderName: "AR - Redline Express", senderEmail: "ar@redlineexpress.com", recipientEmail: "ops@harborfreight.demo", body: "Harbor Freight — please find attached our final invoice for load HFB-3422:\n\nLine-haul: $3,100.00\nLumper advance: $225.00\nFuel Surcharge: $186.00\nTotal Due: $3,511.00\n\nNet 30 terms per our carrier agreement. Please remit to the bank details on file. Invoice #RE-20260524-882.", hoursAgo: 14 },
      ],
    },

    {
      subject: "Tracking link request — HFB-3425 pickup tomorrow",
      customerName: "Acme Foods Inc",
      status: "open",
      priority: "low",
      loadNumber: "HFB-3425",
      messages: [
        { direction: "inbound", senderName: "Night Ops - Acme Foods", senderEmail: "nightops@acmefoods.com", recipientEmail: "ops@harborfreight.demo", body: "Hi — for load HFB-3425 picking up tomorrow, do you have a tracking link we can share with our distribution team? They like to monitor the truck live. Also please confirm carrier name and driver cell number. Thanks.", hoursAgo: 1.5 },
      ],
    },
  ];

  for (const t of threads) {
    const load = t.loadNumber ? loadMap[t.loadNumber] : null;
    const lastMsg = t.messages[t.messages.length - 1];
    const lastAt = new Date(now.getTime() - lastMsg.hoursAgo * 3600000);

    const [thread] = await db.insert(schema.emailThreads).values({
      tenantId: tenant.id,
      inboxId: inbox.id,
      subject: t.subject,
      customerName: t.customerName ?? null,
      carrierName: t.carrierName ?? null,
      status: t.status,
      priority: t.priority,
      lastMessageAt: lastAt,
    }).returning();

    for (const msg of t.messages) {
      const msgAt = new Date(now.getTime() - msg.hoursAgo * 3600000);
      const [message] = await db.insert(schema.emailMessages).values({
        tenantId: tenant.id,
        threadId: thread.id,
        direction: msg.direction,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        recipientEmail: msg.recipientEmail,
        subject: t.subject,
        body: msg.body,
        receivedAt: msgAt,
      }).returning();

      // Auto-classify first inbound messages
      if (msg.direction === "inbound") {
        const keywords: Record<string, string> = {
          status_request: "status|eta|update|where|deliver today|tracking",
          pod_request: "pod|proof of delivery",
          detention_accessorial: "detention|lumper",
          escalation: "urgent|rejected|damage|unacceptable|management",
          quote_request: "quote|rate request",
          bol_request: "bol|bill of lading",
          billing_invoice: "invoice|fuel surcharge",
          rate_confirmation: "rate confirmation|rate con",
          carrier_update: "check call|in transit|delivered|picked up",
          appointment_change: "reschedule|appointment",
        };
        let category = "unknown";
        const text = `${t.subject} ${msg.body}`.toLowerCase();
        for (const [cat, pattern] of Object.entries(keywords)) {
          if (new RegExp(pattern).test(text)) { category = cat; break; }
        }

        await db.insert(schema.aiClassifications).values({
          tenantId: tenant.id,
          messageId: message.id,
          category,
          urgency: t.priority === "urgent" ? "critical" : t.priority === "high" ? "high" : "normal",
          confidence: "0.82",
          extractedLoadNumber: t.loadNumber ?? null,
          extractedCustomer: t.customerName ?? null,
          extractedCarrier: t.carrierName ?? null,
          suggestedAction: category === "status_request" ? "Send latest shipment status." : category === "pod_request" ? "Share POD document if available." : category === "escalation" ? "Escalate to operations lead immediately." : "Review and respond.",
          reasoning: `Keyword match on ${category}.`,
        });

        // Auto-generate drafts for safe categories
        const DRAFT_TEMPLATES: Record<string, string> = {
          status_request: load
            ? `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nThank you for reaching out. Load #${t.loadNumber} is currently ${load.currentStatus?.toLowerCase()} and on track for delivery ${load.deliveryAt ? `on ${load.deliveryAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "as scheduled"}. ${load.eta ? `Current ETA is ${load.eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.` : ""}\n\nPlease let me know if you need anything else.\n\nClyde\nFreight Ops AI`
            : `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nThank you for reaching out. Our team is confirming the latest status with the carrier and will update you shortly.\n\nClyde\nFreight Ops AI`,
          pod_request: `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nThank you for your message regarding load #${t.loadNumber}. Our team is retrieving the signed POD from the carrier and will send it over as soon as it is available, typically within 1–2 business hours.\n\nApologies for any delay in billing.\n\nClyde\nFreight Ops AI`,
          bol_request: `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nHappy to help. Please find the BOL for load #${t.loadNumber} attached. Let me know if you need anything else.\n\nClyde\nFreight Ops AI`,
          appointment_change: `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nThank you for the heads up on the appointment change for load #${t.loadNumber}. I'm coordinating with the carrier now to confirm availability for the new window and will update you shortly.\n\nClyde\nFreight Ops AI`,
          quote_request: `Hi ${t.customerName?.split(" ")[0] ?? "there"},\n\nThank you for reaching out. To provide an accurate quote, could you confirm the following?\n\n- Commodity and weight\n- Pickup date and time window\n- Any special requirements (temp, liftgate, etc.)\n\nWe'll get back to you with pricing as soon as we have those details.\n\nClyde\nFreight Ops AI`,
          carrier_update: `Hi ${t.carrierName ? t.carrierName.split(" ")[0] : "there"},\n\nThank you for the update on load #${t.loadNumber}. Logged. Please send another check call when you are 2 hours out from the delivery.\n\nClyde\nFreight Ops AI`,
        };

        const draftBody = DRAFT_TEMPLATES[category];
        if (draftBody) {
          const requireApproval = ["escalation", "detention_accessorial", "quote_request", "billing_invoice"].includes(category);
          const status = requireApproval ? "pending" : "approved";
          await db.insert(schema.aiDrafts).values({
            tenantId: tenant.id,
            messageId: message.id,
            loadId: load?.id ?? null,
            draftSubject: `Re: ${t.subject}`,
            draftBody,
            confidence: "0.85",
            approvalRequired: requireApproval,
            status,
          });
          // Update thread status to reflect draft state
          await db.update(schema.emailThreads)
            .set({ status: status === "approved" ? "pending_review" : "pending_review" })
            .where(schema.emailThreads.id ? undefined : undefined); // will update below
        }
      }

      // Audit log
      await db.insert(schema.auditLogs).values({
        tenantId: tenant.id,
        actorType: "system",
        actorName: "Clyde",
        entityType: "email_message",
        entityId: message.id,
        action: msg.direction === "inbound" ? "message_received" : "message_sent",
        metadata: { threadId: thread.id, loadId: load?.id ?? null },
      });
    }

    // Workflow actions for escalated thread
    if (t.status === "escalated" && load) {
      await db.insert(schema.workflowActions).values({
        tenantId: tenant.id,
        threadId: thread.id,
        loadId: load.id,
        actionType: "escalate",
        status: "open",
        assignedTo: u1.id,
        notes: "Load rejected at consignee. Ops lead notified. Carrier investigation in progress.",
      });
    }
  }

  console.log(`✅ Seed complete! Tenant ID: ${tenant.id}`);
  console.log(`\n  Add this to your .env.local:\n  DEMO_TENANT_ID="${tenant.id}"\n`);
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
