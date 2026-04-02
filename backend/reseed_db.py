import requests

base_url = "http://localhost:8000"

print("Uploading contracts...")
with open("contracts_1000.csv", "rb") as f:
    resp = requests.post(f"{base_url}/contracts/upload", files={"file": f})
    print(resp.status_code)

print("Uploading logs...")
with open("streaming_logs_13k.csv", "rb") as f:
    resp = requests.post(f"{base_url}/logs/upload", files={"file": f})
    print(resp.status_code)

print("Uploading payments...")
with open("payments_ledger.csv", "rb") as f:
    resp = requests.post(f"{base_url}/payments/upload", files={"file": f})
    print(resp.status_code)

print("Running multi-agent audit pipeline...")
resp = requests.post(f"{base_url}/audit/run")
print(resp.status_code)

print("Exporting final results and violations...")
# Save audit_results.csv
resp = requests.get(f"{base_url}/export/audit_results.csv")
with open("audit_results.csv", "w") as f:
    f.write(resp.text)
    print("- audit_results.csv")

# Save violations.csv
resp = requests.get(f"{base_url}/export/violations.csv")
with open("violations.csv", "w") as f:
    f.write(resp.text)
    print("- violations.csv")

print("Done! All PRD Section 10 files are now available in the project folder.")
