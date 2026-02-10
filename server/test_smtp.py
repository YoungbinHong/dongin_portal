import smtplib
import sys

configs = [
    ("yb_hong@kakao.com", "ghddudqls0", "카카오 계정"),
    ("ybhong1995@daum.net", "ghddudqls0", "Daum 계정"),
    ("ybhong1995@donginlaw.co.kr", "ghddudqls0", "회사 도메인"),
]

for user, password, desc in configs:
    print(f"\n=== 테스트: {desc} ({user}) ===")

    # 포트 587 테스트
    try:
        print("포트 587 (STARTTLS) 시도...")
        smtp = smtplib.SMTP("smtp.daum.net", 587, timeout=10)
        smtp.set_debuglevel(1)
        smtp.starttls()
        smtp.login(user, password)
        print(f"✅ 성공: {desc} - 포트 587")
        smtp.quit()
        sys.exit(0)
    except Exception as e:
        print(f"❌ 실패: {e}")

    # 포트 465 테스트
    try:
        print("포트 465 (SSL) 시도...")
        smtp = smtplib.SMTP_SSL("smtp.daum.net", 465, timeout=10)
        smtp.set_debuglevel(1)
        smtp.login(user, password)
        print(f"✅ 성공: {desc} - 포트 465")
        smtp.quit()
        sys.exit(0)
    except Exception as e:
        print(f"❌ 실패: {e}")

print("\n모든 조합 실패")
