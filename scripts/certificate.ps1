$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=localhost',
        $rsa,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(7))
    try {
        [System.IO.File]::WriteAllBytes(
            $env:ATLYN_CERT_PATH,
            $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $env:ATLYN_CERT_PASSWORD)
        )
    } finally {
        $certificate.Dispose()
    }
} finally {
    $rsa.Dispose()
}
