package trivy

default ignore = false

# The lock records optional binaries for every platform. This Windows-only
# package is not installed in the Linux hosted-staging artifact. Keep the
# exception exact so another package, license expression, or target still
# fails the gate.
ignore {
    input.Type == "license"
    input.PkgName == "@img/sharp-win32-x64"
    input.FilePath == "pnpm-lock.yaml"
    input.Name == "Apache-2.0 AND LGPL-3.0-or-later"
}
