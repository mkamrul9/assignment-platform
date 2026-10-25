# Supplied assessment brief

This records the requirements supplied by the project owner. Detailed Part 2 lesson instructions and the submission deadline have not been supplied. Enhancement plans must not be presented as additional assessment requirements.

> This assessment evaluates your engineering ability, judgment, technical communication, and teaching perception. You will build a full-stack feature, followed by producing two short video lessons (more on that later).
>
> Before starting anything read the whole document from top to bottom.

## Part 1: The project

Build a simple project submission and review dashboard. Initially you can keep your GitHub repo private. But after the submission deadline you must make your repository public. If your repository is not reachable then your submission will be disqualified.

### Technical stack

- Programming Language: TypeScript
- Frontend: Next.js, TailwindCSS, ShadCN
- Backend: Express.js
- Database: PostgreSQL via Prisma ORM
- Auth: JWT based Role-Based Access Control

### Feature requirements

1. Submission Portal (Student View)
   - A form to submit project details: Project name, Repo URL, Live Link, Description.
   - Implement robust validation and prevent duplicate submission.
   - Implement a basic rate limit to prevent spam.
2. Review Dashboard (Mentor View)
   - Paginated Data Table.
   - Approval and rejection action.
   - Filter to show Approved and Rejected projects. Filters should be implemented on the server side.
   - Aggregated statistics, for example Total Pending and Total Approved.
3. Authentication Page
   - Login page.
   - Signup page for students.
   - For now you can seed the admin directly in the database.

There are some ambiguities left in the feature requirements intentionally. Use your best judgment to fill them in.

## Interpretation already used by ReviewDock

The seeded admin is the `MENTOR` role; public signup creates `STUDENT` accounts. Students own their projects. Repository uniqueness is workspace-wide and survives review. Rejection requires useful feedback. Only pending submissions can be decided, and competing reviews cannot overwrite one another. These are documented product decisions, not extra roles or features required by the brief.

The implemented Part 1 feature set has local integration/browser evidence from previous work. A fresh audit must inspect the actual code/assertions before reusing that conclusion. Repository reachability/publication, observed GitHub CI, deployment configuration, and the video deliverables remain separate evidence requirements.
