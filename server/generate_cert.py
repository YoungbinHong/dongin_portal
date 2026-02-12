from cryptography import x509
from cryptography.x509.oid import NameOID, ExtensionOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import datetime
import os
import ipaddress

print("="*50)
print("자체 서명 SSL 인증서 생성")
print("="*50)

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "KR"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "DONGIN"),
    x509.NameAttribute(NameOID.COMMON_NAME, "192.168.0.254"),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(private_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
    .add_extension(
        x509.SubjectAlternativeName([
            x509.IPAddress(ipaddress.IPv4Address("192.168.0.254")),
            x509.DNSName("192.168.0.254"),
        ]),
        critical=False,
    )
    .sign(private_key, hashes.SHA256())
)

certs_dir = os.path.join(os.path.dirname(__file__), "certs")
os.makedirs(certs_dir, exist_ok=True)

key_path = os.path.join(certs_dir, "key.pem")
cert_path = os.path.join(certs_dir, "cert.pem")

with open(key_path, "wb") as f:
    f.write(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ))

with open(cert_path, "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print(f"\n✓ 인증서 생성 완료")
print(f"  - 인증서: {cert_path}")
print(f"  - 키: {key_path}")
print(f"  - 유효기간: 10년")
print(f"\n서버를 재시작하면 HTTPS가 활성화됩니다.")
print("="*50)
