import "server-only";

type TestCredentials = {
  login: string;
  password: string;
  customerId: string;
};

export type TestParcelDimensions = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  depthCm: number;
};

export type MondialRelayApi2ProviderStatus = {
  code: string;
  level: string;
};

export class MondialRelayApi2Error extends Error {
  constructor(
    readonly code: string,
    readonly providerStatuses: MondialRelayApi2ProviderStatus[] = [],
    readonly shipmentNumber?: string,
  ) {
    super(`MONDIAL_RELAY_API2_${code}`);
    this.name = "MondialRelayApi2Error";
  }
}

const API2_SANDBOX_URL =
  "https://connect-api-sandbox.mondialrelay.com/api/shipment";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function element(xml: string, name: string) {
  const match = xml.match(
    new RegExp(
      `<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>`,
      "i",
    ),
  );
  return match ? decodeXml(match[1].trim()) : "";
}

function attribute(source: string, name: string) {
  const match = source.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"),
  );
  return match ? decodeXml(match[2]) : "";
}

function providerStatuses(xml: string) {
  const pattern =
    /<(?:(?:[\w.-]+):)?Status\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:(?:[\w.-]+):)?Status\s*>)/gi;
  return Array.from(xml.matchAll(pattern), (match) => {
    const body = match[2] || "";
    const code = attribute(match[1], "code") || element(body, "Code");
      const rawLevel = attribute(match[1], "level") || element(body, "Level");
      const normalizedLevel = rawLevel.trim().toLowerCase().replace(/\s+/g, " ");
      return {
        code: /^-?[0-9]{1,5}$/.test(code) ? code : "UNKNOWN",
        level:
          normalizedLevel === "warning"
            ? "Warning"
            : normalizedLevel === "critical error"
              ? "Critical Error"
              : "Error",
      };
    });
}

function shipmentNumber(xml: string) {
  const shipment = xml.match(/<(?:(?:[\w.-]+):)?Shipment\b([^>]*)>/i);
  const value =
    shipment?.[1].match(/\bShipmentNumber\s*=\s*["']([^"']+)["']/i)?.[1] ||
    "";
  return /^[0-9A-Z-]{1,24}$/i.test(value) ? value : "";
}

export function buildApi2SandboxTestRequest(
  credentials: TestCredentials,
  parcel: TestParcelDimensions,
) {
  const value = (input: string) => escapeXml(input);
  return `<?xml version="1.0" encoding="utf-8"?>
<ShipmentCreationRequest xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.example.org/Request">
  <Context>
    <Login>${value(credentials.login)}</Login>
    <Password>${value(credentials.password)}</Password>
    <CustomerId>${value(credentials.customerId)}</CustomerId>
    <Culture>fr-FR</Culture>
    <VersionAPI>1.0</VersionAPI>
  </Context>
  <OutputOptions>
    <OutputFormat>10x15</OutputFormat>
    <OutputType>PdfUrl</OutputType>
  </OutputOptions>
  <ShipmentsList>
    <Shipment>
      <OrderNo>MMTEST-MR-API2</OrderNo>
      <CustomerNo>MMTEST</CustomerNo>
      <ParcelCount>1</ParcelCount>
      <DeliveryMode Mode="24R" Location="FR-66974" />
      <CollectionMode Mode="CCC" Location="" />
      <Parcels>
        <Parcel>
          <Content>TEST BAG</Content>
          <Weight Value="${parcel.weightGrams}" Unit="gr" />
          <Length Value="${parcel.lengthCm}" Unit="cm" />
          <Width Value="${parcel.widthCm}" Unit="cm" />
          <Depth Value="${parcel.depthCm}" Unit="cm" />
        </Parcel>
      </Parcels>
      <Sender>
        <Address>
          <Title />
          <Firstname>TEST</Firstname>
          <Lastname>MAISONMIROIR</Lastname>
          <Streetname>RUE DE TEST</Streetname>
          <HouseNo>1</HouseNo>
          <CountryCode>FR</CountryCode>
          <PostCode>78300</PostCode>
          <City>POISSY</City>
          <AddressAdd1 />
          <AddressAdd2 />
          <AddressAdd3 />
          <PhoneNo />
          <MobileNo>+33100000000</MobileNo>
          <Email>sandbox-test@example.com</Email>
        </Address>
      </Sender>
      <Recipient>
        <Address>
          <Title />
          <Firstname>SANDBOX</Firstname>
          <Lastname>TEST</Lastname>
          <Streetname>RUE DE TEST</Streetname>
          <HouseNo>1</HouseNo>
          <CountryCode>FR</CountryCode>
          <PostCode>75001</PostCode>
          <City>PARIS</City>
          <AddressAdd1 />
          <AddressAdd2 />
          <AddressAdd3 />
          <PhoneNo />
          <MobileNo>+33100000000</MobileNo>
          <Email>sandbox-test@example.com</Email>
        </Address>
      </Recipient>
    </Shipment>
  </ShipmentsList>
</ShipmentCreationRequest>`;
}

export function parseApi2SandboxResponse(xml: string) {
  if (xml.length > 1_000_000)
    throw new MondialRelayApi2Error("RESPONSE_TOO_LARGE");
  if (/<(?:[\w.-]+:)?Fault\b/i.test(xml))
    throw new MondialRelayApi2Error("SOAP_FAULT");

  if (!/<(?:(?:[\w.-]+):)?StatusList\b/i.test(xml))
    throw new MondialRelayApi2Error("STATUS_MISSING");
  const number = shipmentNumber(xml);
  const statuses = providerStatuses(xml);
  const malformedStatusList =
    /<(?:(?:[\w.-]+):)?StatusList\b[^>]*>([\s\S]*?)<\/(?:(?:[\w.-]+):)?StatusList\s*>/i.exec(
      xml,
    );
  if (
    malformedStatusList &&
    malformedStatusList[1].trim() &&
    !/<(?:(?:[\w.-]+):)?Status\b/i.test(malformedStatusList[1])
  )
    throw new MondialRelayApi2Error("STATUS_INVALID", [], number || undefined);
  const errors = statuses.filter(
    (status) => status.level.trim().toLowerCase() !== "warning",
  );
  if (errors.length) {
    const codes = errors.map((status) => status.code);
    throw new MondialRelayApi2Error(
      `PROVIDER_${codes.join(",")}`,
      errors,
      number || undefined,
    );
  }
  if (!number)
    throw new MondialRelayApi2Error("SHIPMENT_NUMBER_MISSING");

  const output = element(xml, "Output");
  let labelUrl: URL;
  try {
    labelUrl = new URL(output);
  } catch {
    throw new MondialRelayApi2Error(
      "LABEL_URL_INVALID",
      statuses,
      number,
    );
  }
  if (
    !["http:", "https:"].includes(labelUrl.protocol) ||
    labelUrl.hostname.toLowerCase() !== "connect.mondialrelay.com" ||
    labelUrl.username ||
    labelUrl.password
  )
    throw new MondialRelayApi2Error(
      "LABEL_URL_UNTRUSTED",
      statuses,
      number,
    );
  labelUrl.protocol = "https:";
  return {
    shipmentNumber: number,
    labelUrl: labelUrl.toString(),
    warnings: statuses.filter(
      (status) => status.level.trim().toLowerCase() === "warning",
    ),
  };
}

export async function createApi2SandboxTestShipment(
  credentials: TestCredentials,
  parcel: TestParcelDimensions,
) {
  let response: Response;
  try {
    response = await fetch(API2_SANDBOX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "application/xml",
      },
      body: buildApi2SandboxTestRequest(credentials, parcel),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new MondialRelayApi2Error("NETWORK");
  }
  if (!response.ok)
    throw new MondialRelayApi2Error(`HTTP_${response.status}`);
  const xml = await response.text();
  return parseApi2SandboxResponse(xml);
}
