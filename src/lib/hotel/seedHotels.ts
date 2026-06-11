import type { Hotel } from "./hotelStore";

/**
 * Seed hotels.
 *
 * QST-CHATSWOOD is built from real franchise-hotel front-desk procedures
 * (Quest-style apartment hotel: limited desk hours, night manager, OTA/VCC
 * handling). MERIDIAN-GRAND is a deliberately contrasting full-service
 * property so the demo can show the SAME guest email producing different
 * decisions under different hotel personas — the personalization proof.
 */

export interface SeedHotel {
  hotel: Hotel;
  docs: Array<{ title: string; body: string }>;
}

const QUEST: SeedHotel = {
  hotel: {
    hotel_id: "QST-CHATSWOOD",
    name: "Quest Chatswood",
    brand_style: "Franchise apartment hotel — lean team, strict procedures",
    timezone: "Australia/Sydney",
    persona: {
      front_desk_hours: "07:00-23:00 daily; night manager on call after hours",
      check_in_window: "14:00-23:00 standard; early from 07:00 by request only, never guaranteed",
      late_arrival_policy:
        "After 23:00 a night manager living on site handles check-in; a notice with the night manager's phone number is posted at the door",
      pet_policy_summary: "No pets except certified assistance animals",
      parking_summary: "On-site car park AUD 30 per night; plate and arrival time required; must be noted on the confirmation letter",
      upgrade_authority: "Paid upgrades only, subject to availability; rate difference recharged and daily rates rebalanced",
      voice: "Warm but precise; never promises what the roster cannot deliver",
      signature: "Quest Chatswood Front Office",
    },
  },
  docs: [
    {
      title: "Front desk hours, early and late check-in",
      body: [
        "Front desk operates 07:00-23:00. Standard check-in is from 14:00 to 23:00 and check-out by 10:00.",
        "Early check-in: only possible from 07:00 and only by prior request. It can never be guaranteed because room readiness depends on the previous night's departures and the housekeeping roster. Note the request, check readiness on the day, and tell the guest it is subject to availability.",
        "Late check-in (after 23:00): a night manager lives on site. Record the expected arrival in the system notes for the evening shift. When the desk closes, a notice with the night manager's phone number is posted at the entrance; the guest calls and the night manager comes down to check them in. Confirm the late arrival is noted, never that the desk will be open.",
      ].join("\n\n"),
    },
    {
      title: "OTA bookings and virtual credit cards (VCC)",
      body: [
        "Bookings from Booking.com / Expedia arrive with a voucher (reference) number. Verify the reservation details in the OTA extranet against the local RMS record before doing anything else.",
        "Third-party prepaid bookings use a virtual credit card (VCC). Write 'VCC' in the reservation notes. Retrieve the card number and expiry from the OTA extranet (login plus tablet verification code).",
        "On the morning of arrival, charge all third-party prepaid bookings through the POS terminal using the card number and expiry, then create the receipt and invoice so the balance reconciles to zero.",
        "Required RMS fields that OTAs do not supply (postcode, phone) must not be left empty — enter a placeholder dot. Company field: if unknown, select 'Up to date' and ask at check-in; if the guest declines, change it to 'leisure'.",
      ].join("\n\n"),
    },
    {
      title: "Invoices, receipts and check-out",
      body: [
        "Direct and official-website bookings receive our invoice at check-out. OTA bookings already received an invoice from the OTA — do not issue a second one, but the internal invoice and receipt must still be generated for reconciliation.",
        "At check-out the balance must be zero and both receipt and invoice must exist. Express check-out: the guest may drop the key in the express box and leave, or hand it to the desk.",
        "Company tax invoices require the legal company name, billing contact and address before issuing. Ask for whatever is missing rather than promising the invoice immediately.",
      ].join("\n\n"),
    },
    {
      title: "Room upgrades",
      body: [
        "Upgrade requests on existing bookings: check whether any higher room type is free for the whole stay, including moving other unassigned bookings or using cancellations. If only part of the stay can be upgraded (for example the last three nights), offer that option to the guest and wait for their reply.",
        "Upgrades are paid: recharge the rate difference, then rebalance the daily rate across the stay so every night reconciles. Update the receipt and the invoice after charging. Free upgrades are not offered; anything free requires the franchise manager's explicit approval.",
      ].join("\n\n"),
    },
    {
      title: "Parking",
      body: [
        "On-site car park costs AUD 30 per night and is subject to availability. A parking request needs the vehicle plate and expected arrival time.",
        "When a booking includes parking, write the room rate and 'car parking' in the reservation notes and add the car park line (AUD 30 per night) to the confirmation letter sent to the guest.",
      ].join("\n\n"),
    },
    {
      title: "Maintenance and housekeeping coverage",
      body: [
        "In-room appliance failures (dryer, dishwasher, air conditioning): the front desk contacts the housekeeper or on-call maintenance. If it cannot be fixed the same day, offer practical alternatives (guest laundry, another room if available).",
        "Housekeepers do not work on Sundays. A fault reported on Sunday is logged as a handover for the next shift and the guest is told repair will happen when staff return — never promise same-day repair on a Sunday.",
      ].join("\n\n"),
    },
    {
      title: "Pets",
      body: [
        "Pets are not permitted in apartments, with the sole exception of certified assistance animals with documentation. If a guest asks to bring a pet, apologise, state the policy, and offer to cancel without penalty if the policy makes the stay unworkable. Do not confirm any pet stay; exceptions require the franchise manager.",
      ].join("\n\n"),
    },
  ],
};

const MERIDIAN: SeedHotel = {
  hotel: {
    hotel_id: "MERIDIAN-GRAND",
    name: "The Meridian Grand",
    brand_style: "Full-service 5-star — 24h operation, generous empowerment",
    timezone: "America/New_York",
    persona: {
      front_desk_hours: "24 hours, every day",
      check_in_window: "15:00 standard; early check-in from 10:00 for a USD 40 fee, subject to availability",
      late_arrival_policy: "Desk is staffed around the clock — any arrival hour is fine and needs no special arrangement",
      pet_policy_summary: "Dogs and cats up to 10 kg welcome; USD 50 per stay cleaning fee; weight and vaccination details required",
      parking_summary: "Valet only, USD 65 per night including in-out privileges; no plate needed in advance",
      upgrade_authority:
        "Front desk may upgrade one category when occupancy is below 80%; suites require duty manager sign-off; loyalty Gold members get complimentary category upgrades",
      voice: "Polished, generous, anticipates needs; empowered to say yes within published limits",
      signature: "The Meridian Grand Guest Services",
    },
  },
  docs: [
    {
      title: "Arrival experience and check-in",
      body: [
        "The front desk is staffed 24 hours. Guests may arrive at any hour without prior arrangement; greet late arrivals normally.",
        "Standard check-in is 15:00. Early check-in is sold from 10:00 for USD 40 when a ready room exists; before 10:00 offer luggage storage, lounge access and showers in the fitness centre instead. The fee is waived for loyalty Gold and Platinum members.",
      ].join("\n\n"),
    },
    {
      title: "Pet program",
      body: [
        "Dogs and cats up to 10 kg are welcome in pet-friendly rooms on floors 3-5. A USD 50 per-stay cleaning fee applies. Collect the pet's weight and vaccination status before arrival and book a pet-friendly room type. Pet amenities (bed, bowls) are placed by housekeeping before arrival.",
        "Pets above 10 kg or exotic animals require the duty manager's approval. Assistance animals are always welcome with no fee.",
      ].join("\n\n"),
    },
    {
      title: "Upgrades and empowerment",
      body: [
        "Agents may confirm a one-category upgrade free of charge when forecast occupancy for the stay is below 80%. Suite upgrades always require duty manager sign-off. Loyalty Gold members receive a complimentary category upgrade whenever inventory exists; this can be confirmed in writing.",
        "Paid upgrades may be offered at the published rate difference at any occupancy level.",
      ].join("\n\n"),
    },
    {
      title: "Transport, parking and concierge",
      body: [
        "Parking is valet only at USD 65 per night with in-out privileges; no plate is needed in advance, the valet captures it at the door.",
        "Airport transfers are arranged by the concierge with house cars: flight number, terminal, passenger count and a mobile number are required. Confirm the booking only after the chauffeur dispatcher acknowledges the job.",
      ].join("\n\n"),
    },
    {
      title: "Engineering and housekeeping coverage",
      body: [
        "Engineering is staffed 24/7; in-room faults get a 30-minute response target at any hour, every day of the week. If a fault cannot be fixed within the hour, move the guest to a comparable or better room.",
        "Housekeeping operates daily including Sundays and public holidays.",
      ].join("\n\n"),
    },
    {
      title: "Billing and corporate invoicing",
      body: [
        "Corporate tax invoices are issued by the credit office; they require the legal entity name, billing address and tax ID. The credit office turns these around within one business day.",
        "Virtual cards from OTAs and TMCs are charged at check-in by the duty supervisor; guests never need to present the physical corporate card.",
      ].join("\n\n"),
    },
  ],
};

export const SEED_HOTELS: SeedHotel[] = [QUEST, MERIDIAN];
