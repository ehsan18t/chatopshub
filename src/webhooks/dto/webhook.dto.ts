import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

// WhatsApp Webhook Verification Query
export class WhatsAppVerifyQueryDto {
  @ApiProperty()
  @IsString()
  "hub.mode"!: string;

  @ApiProperty()
  @IsString()
  "hub.verify_token"!: string;

  @ApiProperty()
  @IsString()
  "hub.challenge"!: string;
}

// WhatsApp Webhook Payload Types
export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "sticker"
    | "location"
    | "contacts"
    | "button"
    | "interactive";
  text?: { body: string };
  image?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  document?: WhatsAppMedia;
  sticker?: WhatsAppMedia;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  context?: {
    message_id: string;
    from: string;
  };
}

export interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface WhatsAppStatus {
  id: string;
  recipient_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}

// Messenger Webhook Verification Query
export class MessengerVerifyQueryDto {
  @ApiProperty()
  @IsString()
  "hub.mode"!: string;

  @ApiProperty()
  @IsString()
  "hub.verify_token"!: string;

  @ApiProperty()
  @IsString()
  "hub.challenge"!: string;
}

// Messenger Webhook Payload Types
export interface MessengerWebhookPayload {
  object: "page";
  entry: MessengerEntry[];
}

export interface MessengerEntry {
  id: string;
  time: number;
  messaging: MessengerMessaging[];
}

export interface MessengerMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: MessengerMessage;
  delivery?: MessengerDelivery;
  read?: MessengerRead;
  postback?: MessengerPostback;
}

export interface MessengerMessage {
  mid: string;
  text?: string;
  attachments?: MessengerAttachment[];
  quick_reply?: {
    payload: string;
  };
  reply_to?: {
    mid: string;
  };
}

export interface MessengerAttachment {
  type: "image" | "audio" | "video" | "file" | "location" | "fallback" | "template";
  payload: {
    url?: string;
    sticker_id?: number;
    coordinates?: {
      lat: number;
      long: number;
    };
  };
}

export interface MessengerDelivery {
  mids: string[];
  watermark: number;
}

export interface MessengerRead {
  watermark: number;
}

export interface MessengerPostback {
  title: string;
  payload: string;
}

// Generic webhook DTO
export class WebhookPayloadDto {
  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signature?: string;
}
