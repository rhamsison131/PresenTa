# Presenta

Event registration and QR attendance for campus organizations.

## Run

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Open http://localhost:4000

## Accounts

- Super Admin is created on first start from `.env`. Log in with `ADMIN_USERNAME` (or `ADMIN_EMAIL`) and `ADMIN_PASSWORD`. Defaults: `admin` / `admin123`.
- Super Admin creates SAO Personnel and extra admin accounts.
- Students and organization officers sign up on the login page, then wait for SAO approval.

## Flow

1. Student signs up, SAO approves the account.
2. Officer signs up, SAO accredits the organization and the subscription becomes active.
3. Officer creates and publishes an event with a seat limit, and can open or close registration.
4. Student registers, a seat is reserved, and a notification is sent.
5. On event day the officer displays the event QR, the student scans it, and attendance is recorded with a timestamp. Check-in opens one hour before the start and closes when the event ends.
6. Officer generates the attendance report. Reports are stored by event and school year and can be downloaded as CSV by officers and SAO.

## Profiles and SAO messages

- Everyone can edit their own profile. A student's profile is locked once SAO/admin approves the account.
- SAO personnel write a message when they approve, hold or disapprove a student account, an organization, or an event/payment. Messages arrive as a notification (and email when SMTP is set). The Message button sends a free-form note to a user or organization.

## Notes

- Data is stored in `backend/attendance-data.json`.
- Password reset sends a 6-digit code by email when SMTP is configured. Without SMTP the code is printed in the server console and shown on the reset form unless `NODE_ENV=production`.
- Set `JWT_SECRET` in `.env` before deploying.
- The camera scanner needs HTTPS or localhost. A manual code field is available as a fallback.
