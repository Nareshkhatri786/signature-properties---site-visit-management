
async function getEmail() {
  try {
    const res = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
      headers: { "Metadata-Flavor": "Google" }
    });
    if (res.ok) {
      console.log(await res.text());
    } else {
      console.log("Not on Cloud Run");
    }
  } catch (e) {
    console.log("Local/Unknown");
  }
}
getEmail();
