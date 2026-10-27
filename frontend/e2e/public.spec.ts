import { expect, test } from "@playwright/test";

test.beforeAll(async ({ request }) => {
  const health = await request.get("/api/health/live");
  expect(
    health.ok(),
    "O backend precisa estar no ar em :3001 (npm run start:prod no backend).",
  ).toBe(true);
});

test("a página inicial apresenta os convites de entrada", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /A aventura começa à mesa/ }),
  ).toBeVisible();
  await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
});

test("login e cadastro são acessíveis um pelo outro", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("main")
    .getByRole("link", { name: "Criar conta" })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Nome de exibição")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toBeVisible();
});

test("rota inexistente devolve 404 com a página custom", async ({ page }) => {
  const response = await page.goto("/rota-inexistente-e2e");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ir para o painel" }),
  ).toBeVisible();
});
