import { createServerFn } from "@tanstack/react-start";

export const fetchCompanyInfo = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => {
    const name = (data?.name ?? "").toString().trim().slice(0, 120);
    if (!name) throw new Error("Company name is required");
    return { name };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { info: "" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a meticulous business analyst. Given a company name, return a detailed briefing in PLAIN TEXT (no markdown, no bullet symbols) using EXACTLY these labeled lines, one per line, in this order. Omit a line only if truly unknown. Keep each line concise (max ~160 chars).\n\nOverview: <1-2 sentence description of what they do>\nIndustry: <primary industry / sub-sector>\nHeadquarters: <city, country>\nFounded: <year>\nSize: <employee range or scale, e.g. ~500 employees / Fortune 500>\nWebsite: <root domain like acme.com>\nProducts: <comma separated flagship products or services>\nCustomers: <target market / notable clients>\nFunding: <public ticker, private, last known funding round if notable>\nCulture: <1 sentence on interview style or culture if widely known>\nNotable: <1 sentence on a recent milestone, news, or fun fact>\n\nIf the company is unknown or ambiguous, respond with exactly: No public info available.",
          },
          { role: "user", content: `Company: ${data.name}` },
        ],
      }),
    });

    if (!res.ok) {
      return { info: "" };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const info = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { info };
  });
