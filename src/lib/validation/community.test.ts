import { describe, expect, it } from "vitest";
import { investorApplicationSchema, investorProfileSchema } from "./investor";
import { createCommunityReplySchema, createCommunityThreadSchema } from "./community";

const application = {
  existingInvestorId: "",
  organizationName: "Addis Growth Fund",
  investorType: "investment_fund",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
  contactWhatsapp: "",
  contactTelegram: "",
  contactFacebook: "",
  contactOtherUrl: "",
  background: "We invest in early-stage African companies and support founders with capital and operating expertise.",
  sectors: "fintech, agritech",
  stages: "idea, prototype",
  markets: "Ethiopia, East Africa",
  investmentMin: "",
  investmentMax: "",
  investmentCurrency: "USD",
  portfolio: "",
  proofUrl: "",
};

describe("investor contact routes", () => {
  it("requires at least one way to contact an applicant", () => {
    expect(investorApplicationSchema.safeParse(application).success).toBe(false);
  });

  it("accepts phone, WhatsApp, Telegram, Facebook or another URL as the contact route", () => {
    for (const [key, value] of [
      ["contactPhone", "+251911123456"],
      ["contactWhatsapp", "+251911123456"],
      ["contactTelegram", "@addisfund"],
      ["contactFacebook", "https://facebook.com/addisfund"],
      ["contactOtherUrl", "https://linkedin.com/company/addisfund"],
    ] as const) {
      expect(investorApplicationSchema.safeParse({ ...application, [key]: value }).success).toBe(true);
    }
  });

  it("accepts an email as the only required contact route", () => {
    expect(investorApplicationSchema.safeParse({ ...application, contactEmail: "hello@fund.example" }).success).toBe(true);
  });

  it("requires an investor profile to retain at least one contact route", () => {
    const profile = {
      name: "Addis Growth Fund", description: "", websiteUrl: "", contactUrl: "", investorType: "investment_fund",
      regions: "", sectors: "", stages: "", investmentMin: "", investmentMax: "", investmentCurrency: "USD",
      portfolio: "", thesis: "", contactEmail: "", contactPhone: "", contactWhatsapp: "", contactTelegram: "",
      contactFacebook: "", contactOtherUrl: "", background: "We invest in early-stage African companies and support founders.",
    };
    expect(investorProfileSchema.safeParse(profile).success).toBe(false);
    expect(investorProfileSchema.safeParse({ ...profile, contactWhatsapp: "+251911123456" }).success).toBe(true);
  });
});

describe("community discussion validation", () => {
  it("accepts a thread in one of the fixed founder categories", () => {
    expect(createCommunityThreadSchema.safeParse({
      category: "legal-registration",
      title: "How do I register a company in Ethiopia?",
      body: "I am preparing to register a technology company in Addis Ababa. Which steps and documents should I prepare?",
    }).success).toBe(true);
  });

  it("rejects arbitrary categories and empty replies", () => {
    expect(createCommunityThreadSchema.safeParse({
      category: "random",
      title: "A valid title",
      body: "This is a sufficiently long discussion body for the validation rule.",
    }).success).toBe(false);
    expect(createCommunityReplySchema.safeParse({
      threadId: "11111111-1111-4111-8111-111111111111",
      body: "   ",
    }).success).toBe(false);
  });
});
