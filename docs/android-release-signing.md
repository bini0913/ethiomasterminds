# Android release signing

Master Minds uses a protected Android upload key for Play Console releases. The
private keystore and passwords must never be committed to this repository,
uploaded as workflow artifacts, or printed in CI logs.

## Current behavior before the key is configured

- Pull requests and main can build the release AAB as a compile/package check.
- Without all four signing secrets, the AAB is **not signed and is not attached**
  to a GitHub release.
- If only some signing secrets are configured, the workflow fails immediately.
- Once all four secrets are present, CI decodes the keystore into the runner's
  temporary directory, signs the AAB through Gradle, verifies the signature,
  and only then includes the AAB in the GitHub release.
- The debug APK remains available for development testing; it is not a
  Play Store upload.

## Create the upload key when Play Console setup is ready

Have the adult who owns/manages the Play Console account create and safeguard
the upload key. Coordinate the key with the Play Console app's Play App Signing
setup. Do not create a replacement key if one has already been registered.

On a trusted computer with a current JDK, generate a dedicated upload key.
Use a long, unique keystore password and key password, and record the alias.
Keep at least two secure offline backups of the resulting keystore and recovery
details. Do not send the keystore or passwords through chat or email.

Example command (replace the alias and validity details as appropriate):

```bash
keytool -genkeypair -v \
  -keystore masterminds-upload-key.jks \
  -alias masterminds-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

The keystore is a private credential. Keep it outside the repository and do not
commit it, even temporarily.

## Configure GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions → New
repository secret** and configure all four:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of the complete JKS file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Alias used when generating the key |
| `ANDROID_KEY_PASSWORD` | Password for that key |

On PowerShell, produce the base64 value without modifying the keystore:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secure\masterminds-upload-key.jks"))
```

Copy the output directly into the `ANDROID_KEYSTORE_BASE64` secret. Do not
put the base64 output in a repository file, issue, pull request, or chat.

## Verify setup

After all four secrets are configured, run the Android workflow on the main
branch. Confirm that:

1. The `Prepare protected release signing` step reports signing is ready.
2. `Verify signed release AAB` passes.
3. The generated `app-release.aab` is attached to the GitHub release.
4. The certificate SHA-256 fingerprint matches the upload certificate
   registered with Play Console.

The workflow deliberately does not upload an unsigned AAB. Keep the upload
keystore and backups for the lifetime of the app; future updates must use the
registered upload key (or the official Play Console key-reset process).
