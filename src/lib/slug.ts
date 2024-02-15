/**
 * convert a uuid to a slug by converting it to base64
 * @param uuid
 * @returns
 */
export function uuidToSlug(uuid: string): string {
  // Remove dashes and convert to a byte array
  const hex = uuid.replace(/-/g, "");
  const byteArray = new Uint8Array(
    hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  // Convert byte array to Base64
  const base64String = btoa(
    String.fromCharCode.apply(null, Array.from(byteArray)),
  );

  // Make it URL safe by replacing '+' with '-', '/' with '_', and removing '='
  return base64String
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * convert a slug to a uuid by converting it from base64
 * @param base64
 * @returns
 */
export function slugToUuid(base64: string): string {
  try {
    // Convert URL-safe Base64 back to standard Base64
    let standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");

    // Pad Base64 string to make it valid
    while (standardBase64.length % 4) {
      standardBase64 += "=";
    }

    // Decode Base64 to byte array
    const decodedBytes = atob(standardBase64)
      .split("")
      .map((char) => char.charCodeAt(0));

    // Convert byte array to UUID hex string with dashes
    const hexArray = decodedBytes.map((byte) =>
      ("0" + (byte & 0xff).toString(16)).slice(-2),
    );
    return `${hexArray.slice(0, 4).join("")}-${hexArray.slice(4, 6).join("")}-${hexArray.slice(6, 8).join("")}-${hexArray.slice(8, 10).join("")}-${hexArray.slice(10, 16).join("")}`;
  } catch (error) {
    return "invalid slug";
  }
}
