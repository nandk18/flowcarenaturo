# FlowCare — how patient data is protected

## In transit
All traffic between the app, the API and the database uses HTTPS/TLS. The app is
served only over HTTPS on https://www.goflowcare.com.

## At rest
- The managed Postgres database and all file storage (patient documents,
  prescriptions, invoices) are encrypted at rest with AES-256 by the hosting
  platform. Automated backups are encrypted with the same standard.
- Passwords are never stored in readable form; they are salted and hashed.
- Clinic staff PINs and clinic Twilio credentials are stored hashed or encrypted,
  never in plain text.

## Field-level encryption
The most sensitive free-text patient fields are additionally encrypted inside the
database with pgcrypto, using a key held outside the application tables:

- `medication_history`
- `past_surgery_details`
- `emergency_contact_phone`

Values are encrypted on write and decrypted on read through security-definer
database functions, so anyone reading the underlying table directly sees only
ciphertext. Existing records were converted when the change was applied.

## Access control
- Every table is protected by row-level security so a clinic can only ever read or
  write its own records.
- Roles (admin, doctor, receptionist, lab, super admin) are stored in a separate
  roles table and checked server-side.
- Settings areas holding analytics and configuration are protected by a clinic PIN.
- Server-side keys (Twilio, encryption key, service role) live in the secret store
  and are only available to backend functions, never to the browser.

## Auditing
Sensitive actions are recorded in `audit_logs` with the acting user, role, action
and affected record, so access can be reviewed later.
