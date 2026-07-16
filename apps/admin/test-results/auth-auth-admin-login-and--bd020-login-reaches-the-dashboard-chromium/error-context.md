# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> auth: admin login and customer rejection >> ADMIN login reaches the dashboard
- Location: e2e/auth.spec.ts:11:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Email')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - text: The server is configured with a public base URL of /admin - did you mean to visit
    - link "/admin/login" [ref=e2] [cursor=pointer]:
        - /url: /admin/login
    - text: instead?
```

# Test source

```ts
  31  | /**
  32  |  * Direct HTTP helpers against the spawned test API instance, bypassing the
  33  |  * admin UI entirely. Used only for setup steps the admin app has no reason
  34  |  * to expose itself — e.g. registering a CUSTOMER account, or placing an
  35  |  * order as that customer so the ADMIN order-list/detail scenario has
  36  |  * something real to browse. Every actual admin-facing flow under test still
  37  |  * goes through the real browser and the real Angular pages.
  38  |  */
  39  | async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  40  |   const response = await fetch(`${TEST_API_BASE_URL}${path}`, {
  41  |     ...init,
  42  |     headers: { 'Content-Type': 'application/json', ...init.headers },
  43  |   });
  44  |   if (!response.ok) {
  45  |     const body = await response.text();
  46  |     throw new Error(
  47  |       `Test API request failed: ${init.method ?? 'GET'} ${path} -> ${response.status} ${body}`,
  48  |     );
  49  |   }
  50  |   const text = await response.text();
  51  |   return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
  52  | }
  53  |
  54  | interface TokenPair {
  55  |   accessToken: string;
  56  |   refreshToken: string;
  57  | }
  58  |
  59  | /** Registers a fresh CUSTOMER account directly via the API and logs it in, returning its access token. */
  60  | export async function registerCustomerDirect(user: TestUser): Promise<string> {
  61  |   await apiRequest('/api/v1/auth/register', {
  62  |     method: 'POST',
  63  |     body: JSON.stringify(user),
  64  |   });
  65  |   const { data } = await apiRequest<ApiEnvelope<TokenPair>>('/api/v1/auth/login', {
  66  |     method: 'POST',
  67  |     body: JSON.stringify({ email: user.email, password: user.password }),
  68  |   });
  69  |   return data.accessToken;
  70  | }
  71  |
  72  | export async function loginAsAdminDirect(): Promise<string> {
  73  |   const { data } = await apiRequest<ApiEnvelope<TokenPair>>('/api/v1/auth/login', {
  74  |     method: 'POST',
  75  |     body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
  76  |   });
  77  |   return data.accessToken;
  78  | }
  79  |
  80  | export interface ProductSummary {
  81  |   id: string;
  82  |   slug: string;
  83  |   name: string;
  84  | }
  85  |
  86  | /** Reads the seeded catalog directly from the API (public endpoint, no auth needed). */
  87  | export async function listProductsDirect(): Promise<ProductSummary[]> {
  88  |   const { data } = await apiRequest<ApiEnvelope<ProductSummary[]>>('/api/v1/products?limit=100');
  89  |   return data;
  90  | }
  91  |
  92  | export interface CategorySummary {
  93  |   id: string;
  94  |   slug: string;
  95  |   name: string;
  96  | }
  97  |
  98  | /** Reads the full category list directly from the API. */
  99  | export async function listCategoriesDirect(): Promise<CategorySummary[]> {
  100 |   const { data } = await apiRequest<ApiEnvelope<CategorySummary[]>>('/api/v1/categories');
  101 |   return data;
  102 | }
  103 |
  104 | /**
  105 |  * Places a single-item order as the given CUSTOMER access token, returning
  106 |  * the created order's id. Used to give the ADMIN order list/detail
  107 |  * scenario a real, cross-customer order to browse without driving the
  108 |  * (nonexistent, storefront-only) checkout UI from this suite.
  109 |  */
  110 | export async function placeOrderDirect(
  111 |   customerAccessToken: string,
  112 |   productId: string,
  113 |   quantity = 1,
  114 | ): Promise<string> {
  115 |   const { data } = await apiRequest<ApiEnvelope<{ id: string }>>('/api/v1/orders', {
  116 |     method: 'POST',
  117 |     headers: { Authorization: `Bearer ${customerAccessToken}` },
  118 |     body: JSON.stringify({ items: [{ productId, quantity }] }),
  119 |   });
  120 |   return data.id;
  121 | }
  122 |
  123 | /**
  124 |  * Logs into the admin SPA through the real `/login` form as the seeded
  125 |  * ADMIN user, and waits for the redirect to the dashboard (`/`) that
  126 |  * `LoginPage` performs once it confirms the authenticated user's role is
  127 |  * `ADMIN`.
  128 |  */
  129 | export async function loginAsAdmin(page: Page): Promise<void> {
  130 |   await page.goto('/login');
> 131 |   await page.getByLabel('Email').fill(TEST_ADMIN_EMAIL);
      |                                  ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  132 |   await page.getByLabel('Password').fill(TEST_ADMIN_PASSWORD);
  133 |   await page.getByRole('button', { name: 'Sign in' }).click();
  134 |   await page.waitForURL((url) => url.pathname === '/');
  135 | }
  136 |
  137 | /**
  138 |  * Submits the `/login` form as the given (non-admin) user. Does not wait
  139 |  * for any redirect: the whole point of the "CUSTOMER login is rejected"
  140 |  * scenario is that no navigation away from `/login` ever happens, so the
  141 |  * caller is expected to assert on the resulting error state itself.
  142 |  */
  143 | export async function submitLogin(
  144 |   page: Page,
  145 |   user: Pick<TestUser, 'email' | 'password'>,
  146 | ): Promise<void> {
  147 |   await page.goto('/login');
  148 |   await page.getByLabel('Email').fill(user.email);
  149 |   await page.getByLabel('Password').fill(user.password);
  150 |   await page.getByRole('button', { name: 'Sign in' }).click();
  151 | }
  152 |
```
