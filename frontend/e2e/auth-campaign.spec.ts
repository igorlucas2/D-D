import { expect, test } from "@playwright/test";

test.beforeAll(async ({ request }) => {
  const health = await request.get("/api/health/live");
  expect(
    health.ok(),
    "O backend precisa estar no ar em :3001 (npm run start:prod no backend).",
  ).toBe(true);
});

test("cadastro leva ao painel e permite criar e abrir uma campanha", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const displayName = `Teste E2E ${stamp}`;
  const campaignName = `Campanha E2E ${stamp}`;

  await page.goto("/register");
  await page.getByLabel("Nome de exibição").fill(displayName);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-e2e-123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(
    page.getByText(/Sua próxima história começa aqui/),
  ).toBeVisible();
  await expect(page.getByText(displayName).first()).toBeVisible();

  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nova campanha" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(campaignName);
  await page.getByRole("button", { name: "Criar campanha" }).click();

  const campaignLink = page.getByRole("link", {
    name: new RegExp(campaignName),
  });
  await expect(campaignLink).toBeVisible({ timeout: 20_000 });
  await campaignLink.click();

  await expect(page).toHaveURL(/\/campaigns\/[^/]+$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: campaignName, exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Mesa", { exact: true }).first()).toBeVisible();

  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem("rpg-auth");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const state = (parsed as { state?: unknown }).state;
    if (!state || typeof state !== "object") return null;
    const value = (state as { token?: unknown }).token;
    return typeof value === "string" ? value : null;
  });
  expect(token).toBeTruthy();

  const campaignId = page.url().split("/").pop();
  expect(campaignId).toBeTruthy();
  const auth = { Authorization: `Bearer ${token}` };
  const patchResponse = await request.patch(`/api/campaigns/${campaignId}`, {
    headers: auth,
    data: { name: `${campaignName} editada` },
  });
  expect(patchResponse.status()).toBe(200);

  await expect
    .poll(async () => {
      const response = await request.get(
        `/api/campaigns/${campaignId}/audit`,
        { headers: auth },
      );
      if (!response.ok()) return `status ${response.status()}`;
      const body = (await response.json()) as {
        items?: { action?: string }[];
      };
      return body.items?.[0]?.action ?? null;
    })
    .toBe("campaign.update");
});
