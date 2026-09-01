import { SendPolicy } from "../../../services/MessagingServices/policy";
export interface SendMessageOptions {
  policy?: SendPolicy;
  quotedMessageId?: string;
  quotedMessageFromMe?: boolean;
  linkPreview?: boolean;
}

export interface SendMediaOptions {
  policy?: SendPolicy;
  caption?: string;
  sendAudioAsVoice?: boolean;
  sendMediaAsDocument?: boolean;
  sendAsSticker?: boolean;
  quotedMessageId?: string;
}
