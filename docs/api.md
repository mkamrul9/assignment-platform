# API contracts and runnable examples

Browser requests use the web origin's relative `/api` routes. The examples below use the local Next.js proxy at `http://localhost:3000`; set it to your configured web origin. Start both applications, apply migrations, and seed a mentor first. These examples create synthetic records in the configured development database; automated test commands use disposable databases instead.

## Contracts

- `POST /api/auth/signup`: `{ name, email, password }` -> `201 { user }`; always creates a student and sets the cookie. Name is trimmed, email is normalized, privileged/unknown fields are rejected, duplicate email is `409`.
- `POST /api/auth/login`: `{ email, password }` -> `200 { user }` and cookie. Unknown email and incorrect password share the same `401` error.
- `GET /api/auth/me`: `200 { user }` or `401`. Safe user fields: `id`, `name`, `email`, `role`, `createdAt`. Tokens and password hashes never appear in JSON.
- `GET /api/demo/accounts`: only when `DEMO_MODE=1`; `200 { notice, accounts }` with intentionally public synthetic emails/passwords. Absent/404 when demo mode is off. Never includes real mentor credentials, JWT secrets, or database URLs.
- `POST /api/auth/logout`: `204`, clearing the cookie even if it is missing/expired. Signup, login, logout, submissions, and decisions require an exact trusted `Origin`.
- `POST /api/submissions`: student only; `{ projectName, repositoryUrl, liveUrl, description }` -> `201 { submission }`, initially `PENDING`. Unknown/privileged fields are rejected. Repository duplicates return `409` without identifying another student.
- `GET /api/submissions/mine`: student only; `200 { submissions, pagination, stats }`. Query: `page` (default 1), `pageSize` (default 10, max 50), `status` (`ALL` default, also `PENDING`/`APPROVED`/`REJECTED`), optional trimmed `q` (max 100; project name and repository URL). Ownership comes from the session only. Filtering, search, counting, ordering, and pagination run in PostgreSQL. Rows are newest first by `createdAt`, then `id`, both descending. Includes stored review decision, note, checkpoints, and timestamp when available. `stats` are owner-scoped totals independent of list filters. Empty results use `totalPages: 0`; out-of-range pages return an empty `submissions` array with metadata for the requested page. Repeated/invalid/unknown query fields are rejected.
- `GET /api/submissions/:id`: student or mentor; `200 { submission }`. Students may read only their own rows (missing or another student's project → `404` without disclosure). Mentors may read submissions in the review workflow. `/mine` is registered before `/:id`. Safe fields only; `Cache-Control: no-store`.
- `GET /api/reviews/submissions`: mentor only; `200 { submissions, pagination }`. Safe project/student/reviewer fields are explicitly selected.
- `GET /api/reviews/stats`: mentor only; `200 { stats: { pending, approved, rejected, total } }`. One database aggregation counts every submission independently of filters/search.
- `POST /api/reviews/submissions/:id/decision`: mentor only; `{ decision, note?, checkpoints? }` -> `200 { submission }`. Only pending projects can transition. Missing IDs return `404`; repeated/competing decisions return `409` and cannot overwrite the winning review.

Private list/current-user responses are non-cacheable. Missing or invalid authentication is `401`; insufficient role is `403`. All four submission fields are required and trimmed: name 3–100 characters, description 20–5,000, each URL at most 2,048. URLs must be absolute HTTPS without embedded credentials; the server does not fetch them.

Repository canonicalization removes query/fragment, trailing slashes, and a final `.git`; GitHub owner/repository names are case-insensitive. Other hosts retain path case, meaningful separators, and non-default ports. The submitted URL is stored separately. Uniqueness applies across students and statuses.

Queue parameters: `page=1`, `pageSize=10` (maximum 50), `status=PENDING` (`ALL`, `PENDING`, `APPROVED`, `REJECTED`), optional trimmed `q` (maximum 100 characters). Search covers project name, repository URL, and student name/email. Repeated, fractional, invalid, unknown, or overflowing pagination input is rejected. Sorting/counting/filtering/pagination run in PostgreSQL. Empty queues have `totalPages: 0`; an out-of-range page returns an empty array with metadata for the requested page.

```json
{
  "submissions": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Decisions are `APPROVED` or `REJECTED`. Rejection requires a trimmed 10–1,000 character note. Approval notes are optional, at most 1,000; blank becomes null. Optional checkpoint keys are `functionality`, `usability`, `documentation`; values are `MEETS_EXPECTATIONS`, `NEEDS_IMPROVEMENT`, `NOT_ASSESSED`. Missing checkpoints default to `NOT_ASSESSED`. Reviewer, timestamps, ownership, and status cannot be supplied by clients.

Errors use `{ error: { code, message, details?, retryAfterSeconds? } }`. Field details contain `{ path, message }`. HTTP 429 includes `Retry-After`. Bounded JSON bodies larger than 64 KiB return 413. The web proxy returns safe JSON 502/504 when its API upstream is unavailable/timed out.

## Bash lifecycle

Run all blocks in the same shell. Cookie jars are secrets; the `.local` directory is ignored by Git. Node is used only to encode JSON safely and read the created ID; no jq dependency is needed.

```sh
BASE=http://localhost:3000
mkdir -p .local/api-example
STUDENT_COOKIES=.local/api-example/student.txt
MENTOR_COOKIES=.local/api-example/mentor.txt
STAMP=$(date +%s)

curl --fail-with-body -sS -c "$STUDENT_COOKIES" \
  -H "Origin: $BASE" -H 'Content-Type: application/json' \
  --data "{\"name\":\"Example Student\",\"email\":\"student-$STAMP@example.com\",\"password\":\"student-example-pass-1\"}" \
  "$BASE/api/auth/signup"

curl --fail-with-body -sS -b "$STUDENT_COOKIES" "$BASE/api/auth/me"
```

Submit and save the ID:

```sh
curl --fail-with-body -sS -b "$STUDENT_COOKIES" \
  -H "Origin: $BASE" -H 'Content-Type: application/json' \
  --data "{\"projectName\":\"Example Project\",\"repositoryUrl\":\"https://github.com/example/reviewdock-$STAMP\",\"liveUrl\":\"https://demo-$STAMP.example.com\",\"description\":\"A complete example project description for the review workflow.\"}" \
  "$BASE/api/submissions" > .local/api-example/submission.json

PROJECT_ID=$(node -p "JSON.parse(require('node:fs').readFileSync('.local/api-example/submission.json','utf8')).submission.id")
```

Sign in as your seeded mentor. The password is read without echoing and sent as encoded JSON to the proxy:

```sh
read -r -p 'Seeded mentor email: ' mentor_email
read -r -s -p 'Seeded mentor password: ' mentor_password
MENTOR_EMAIL="$mentor_email" MENTOR_PASSWORD="$mentor_password" \
  node -e 'process.stdout.write(JSON.stringify({email:process.env.MENTOR_EMAIL,password:process.env.MENTOR_PASSWORD}))' \
  | curl --fail-with-body -sS -c "$MENTOR_COOKIES" \
      -H "Origin: $BASE" -H 'Content-Type: application/json' --data-binary @- \
      "$BASE/api/auth/login"
unset mentor_password

curl --fail-with-body -sS -b "$MENTOR_COOKIES" "$BASE/api/reviews/submissions?status=PENDING&page=1&pageSize=10"
curl --fail-with-body -sS -b "$MENTOR_COOKIES" "$BASE/api/reviews/stats"

curl --fail-with-body -sS -b "$MENTOR_COOKIES" \
  -H "Origin: $BASE" -H 'Content-Type: application/json' \
  --data '{"decision":"REJECTED","note":"Please expand the README with complete setup steps.","checkpoints":{"documentation":"NEEDS_IMPROVEMENT"}}' \
  "$BASE/api/reviews/submissions/$PROJECT_ID/decision"

curl --fail-with-body -sS -b "$STUDENT_COOKIES" "$BASE/api/submissions/mine?page=1&pageSize=10&status=ALL"
curl --fail-with-body -sS -b "$STUDENT_COOKIES" "$BASE/api/submissions/$PROJECT_ID"
curl --fail-with-body -sS -b "$STUDENT_COOKIES" -c "$STUDENT_COOKIES" -X POST -H "Origin: $BASE" "$BASE/api/auth/logout"
curl --fail-with-body -sS -b "$MENTOR_COOKIES" -c "$MENTOR_COOKIES" -X POST -H "Origin: $BASE" "$BASE/api/auth/logout"
```

## PowerShell lifecycle

`Invoke-RestMethod` keeps cookies in session objects; it avoids the Windows PowerShell `curl` alias and shell JSON escaping differences. Run these blocks in the same terminal.

```powershell
$base = 'http://localhost:3000'
$headers = @{ Origin = $base }
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$signupBody = @{
  name = 'Example Student'
  email = "student-$stamp@example.com"
  password = 'student-example-pass-1'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/auth/signup" -Headers $headers `
  -ContentType 'application/json' -Body $signupBody -SessionVariable student
Invoke-RestMethod -Uri "$base/api/auth/me" -WebSession $student

$submissionBody = @{
  projectName = 'Example Project'
  repositoryUrl = "https://github.com/example/reviewdock-$stamp"
  liveUrl = "https://demo-$stamp.example.com"
  description = 'A complete example project description for the review workflow.'
} | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri "$base/api/submissions" -Headers $headers `
  -ContentType 'application/json' -Body $submissionBody -WebSession $student
$projectId = $created.submission.id
```

Sign in with your seeded mentor:

```powershell
$mentorEmail = Read-Host 'Seeded mentor email'
$mentorPassword = Read-Host 'Seeded mentor password' -AsSecureString
$mentorBody = @{
  email = $mentorEmail
  password = ([System.Net.NetworkCredential]::new('', $mentorPassword)).Password
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -Headers $headers `
  -ContentType 'application/json' -Body $mentorBody -SessionVariable mentor
Remove-Variable mentorBody, mentorPassword

Invoke-RestMethod -Uri "$base/api/reviews/submissions?status=PENDING&page=1&pageSize=10" -WebSession $mentor
Invoke-RestMethod -Uri "$base/api/reviews/stats" -WebSession $mentor

$decisionBody = @{
  decision = 'REJECTED'
  note = 'Please expand the README with complete setup steps.'
  checkpoints = @{ documentation = 'NEEDS_IMPROVEMENT' }
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/reviews/submissions/$projectId/decision" `
  -Headers $headers -ContentType 'application/json' -Body $decisionBody -WebSession $mentor

Invoke-RestMethod -Uri "$base/api/submissions/mine?page=1&pageSize=10&status=ALL" -WebSession $student
Invoke-RestMethod -Uri "$base/api/submissions/$projectId" -WebSession $student
Invoke-RestMethod -Method Post -Uri "$base/api/auth/logout" -Headers $headers -WebSession $student
Invoke-RestMethod -Method Post -Uri "$base/api/auth/logout" -Headers $headers -WebSession $mentor
```

The final student list and detail responses include `REJECTED`, the note, and the documentation checkpoint. Use a new synthetic repository URL for another run: canonical URLs remain reserved after a review. Approval uses the same decision endpoint with `APPROVED` and an optional note.
