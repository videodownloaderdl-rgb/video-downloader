export function detectPlatform(rawUrl) {

    const hostname =
        new URL(rawUrl)
            .hostname
            .toLowerCase()
            .replace(/^www\./, "");

    if (
        hostname === "youtube.com" ||
        hostname === "youtu.be" ||
        hostname.endsWith(".youtube.com")
    ) {
        return "YouTube";
    }

    if (
        hostname === "tiktok.com" ||
        hostname.endsWith(".tiktok.com")
    ) {
        return "TikTok";
    }

    if (
        hostname === "instagram.com" ||
        hostname.endsWith(".instagram.com")
    ) {
        return "Instagram";
    }

    if (
        hostname === "facebook.com" ||
        hostname === "fb.watch" ||
        hostname.endsWith(".facebook.com")
    ) {
        return "Facebook";
    }

    if (
        hostname === "twitter.com" ||
        hostname === "x.com" ||
        hostname.endsWith(".twitter.com") ||
        hostname.endsWith(".x.com")
    ) {
        return "X/Twitter";
    }

    if (
        hostname === "vimeo.com" ||
        hostname.endsWith(".vimeo.com")
    ) {
        return "Vimeo";
    }

    return "Otra";
}


export function validatePublicUrl(rawUrl) {

    let url;

    try {

        url = new URL(rawUrl);

    } catch {

        throw new Error(
            "La URL no es válida."
        );

    }

    if (
        !["http:", "https:"]
            .includes(url.protocol)
    ) {

        throw new Error(
            "Solo se permiten URLs HTTP o HTTPS."
        );

    }

    const hostname =
        url.hostname.toLowerCase();


    if (
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "0.0.0.0" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local")
    ) {

        throw new Error(
            "No se permiten direcciones locales."
        );

    }


    if (
        /^\d+\.\d+\.\d+\.\d+$/
            .test(hostname)
    ) {

        const [
            a,
            b
        ] = hostname
            .split(".")
            .map(Number);


        if (
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        ) {

            throw new Error(
                "No se permiten direcciones privadas."
            );

        }

    }


    return url.toString();

}