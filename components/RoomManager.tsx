"use client";

import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { 
  generateRoomId,
} from "@/lib/crypto";
import { 
  parseKeyExchangeQR,
  parseKeyExchangeLink,
  generateRoomInvite,
} from "@/lib/key-exchange";
import { 
  initSignalProtocol,
  processPreKeyBundle,
} from "@/lib/signal-protocol";
import storage from "@/lib/storage";
import { IdentityKey, Room } from "@/lib/types";
import { KeyExchangeInvite } from "@/lib/key-exchange";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface RoomManagerProps {
  identity: IdentityKey;
  onRoomJoined: (roomId: string, roomName?: string) => void;
}

type RoomManagerStep = "list" | "create" | "join" | "share";

export default function RoomManager({ identity, onRoomJoined }: RoomManagerProps) {
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [currentStep, setCurrentStep] = useState<RoomManagerStep>("list");
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<string>("");
  const [createdRoomId, setCreatedRoomId] = useState<string>("");
  const [createdRoomName, setCreatedRoomName] = useState<string>("");
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadActiveRooms();
    initializeSignalProtocol();
  }, []);

  const initializeSignalProtocol = async () => {
    try {
      await initSignalProtocol();
    } catch (error) {
      setError(`Failed to initialize Signal protocol: ${error}`);
    }
  };

  const loadActiveRooms = async () => {
    try {
      const storedRooms = await storage.getAllRooms();
      const rooms: Room[] = storedRooms.map(sr => ({
        id: sr.room_id,
        name: sr.name,
        participants: sr.participants,
        createdAt: sr.joinedAt
      }));
      setActiveRooms(rooms);
    } catch (error) {
      setError(`Failed to load rooms: ${error}`);
    }
  };

  const handleCreateRoom = async () => {
    setError("");
    setIsLoading(true);

    try {
      const roomId = generateRoomId();
      const finalRoomName = roomName || "Private Chat";
      
      await storage.saveRoom(
        roomId,
        finalRoomName,
        [identity.fingerprint]
      );

      const invite = await generateRoomInvite(identity, roomId);
      setGeneratedInvite(invite.qrCode);
      setCreatedRoomId(roomId);
      setCreatedRoomName(finalRoomName);
      
      await loadActiveRooms();
      setCurrentStep("share");
      
    } catch (error) {
      setError(`Failed to create room: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setError("");
    setIsLoading(true);

    try {
      let invite: KeyExchangeInvite;
      
      if (inviteCode.startsWith("anochat://")) {
        invite = await parseKeyExchangeLink(inviteCode);
      } else {
        invite = await parseKeyExchangeQR(inviteCode);
      }

      if (!invite.preKeyBundle || !invite.senderFingerprint) {
        throw new Error("Invalid invite format");
      }

      await processPreKeyBundle(
        invite.senderFingerprint,
        1,
        invite.preKeyBundle
      );

      if (invite.roomId) {
        await storage.saveRoom(
          invite.roomId,
          "Private Chat",
          [identity.fingerprint, invite.senderFingerprint]
        );
        
        await loadActiveRooms();
        onRoomJoined(invite.roomId, "Private Chat");
      }

      setCurrentStep("list");
      resetForm();
      
    } catch {
      setError(`Invalid invite code. Please check and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinExistingRoom = (room: Room) => {
    onRoomJoined(room.id, room.name);
  };

  const resetForm = () => {
    setRoomName("");
    setInviteCode("");
    setGeneratedInvite("");
    setCreatedRoomId("");
    setCreatedRoomName("");
    setShowQR(false);
    setError("");
    setCopied(false);
    setCurrentStep("list");
  };

  const copyInviteToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedInvite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy invite");
    }
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="text-center bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
          💬 Your Chats
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {currentStep === "list" && (
          <div className="space-y-6">
            {activeRooms.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-anon-300 flex items-center space-x-2">
                  <span>💭</span>
                  <span>Active Conversations</span>
                </h3>
                <div className="space-y-2">
                  {activeRooms.map((room) => (
                    <Card
                      key={room.id}
                      variant="bordered"
                      className="cursor-pointer hover:border-phantom-500 transition-all duration-200 hover:shadow-lg"
                      onClick={() => handleJoinExistingRoom(room)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-phantom-500/20 to-phantom-700/20 rounded-lg flex items-center justify-center">
                              <span className="text-lg">💬</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-anon-200">
                                {room.name || "Private Chat"}
                              </div>
                              <div className="text-xs text-anon-500">
                                {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-anon-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card variant="glass" className="text-center">
                <CardContent className="py-8 space-y-3">
                  <div className="w-16 h-16 bg-anon-800/50 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl">💭</span>
                  </div>
                  <h3 className="text-lg font-medium text-anon-200">No Active Chats</h3>
                  <p className="text-sm text-anon-400 max-w-xs mx-auto">
                    Start a new conversation or join one with a friend&apos;s invite
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secure"
                onClick={() => setCurrentStep("create")}
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Start New Chat
              </Button>
              <Button
                variant="phantom"
                onClick={() => setCurrentStep("join")}
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                }
              >
                Join Friend&apos;s Chat
              </Button>
            </div>
          </div>
        )}

        {currentStep === "share" && (
          <Card variant="glass" className="bg-secure-950/20 border-secure-700/50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-secure-300">
                  ✨ Chat Created Successfully!
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-6 w-6 p-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </Button>
              </div>
              
              <p className="text-xs text-anon-300">
                Share this invite with your friend to start chatting privately:
              </p>
              
              <div className="flex space-x-2">
                <Button
                  variant={showQR ? "secure" : "ghost"}
                  size="sm"
                  onClick={() => setShowQR(!showQR)}
                  icon={
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <rect x="7" y="7" width="3" height="3"/>
                      <rect x="14" y="7" width="3" height="3"/>
                      <rect x="7" y="14" width="3" height="3"/>
                    </svg>
                  }
                >
                  {showQR ? "Hide" : "Show"} QR Code
                </Button>
                <Button
                  variant={copied ? "secure" : "ghost"}
                  size="sm"
                  onClick={copyInviteToClipboard}
                  icon={
                    copied ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    )
                  }
                >
                  {copied ? "Copied!" : "Copy Invite"}
                </Button>
              </div>

              {showQR && (
                <div className="bg-white p-4 rounded-lg text-center">
                  <QRCode
                    value={generatedInvite}
                    size={180}
                    className="mx-auto"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Scan with phone camera
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-anon-700">
                <Button
                  variant="phantom"
                  onClick={() => {
                    onRoomJoined(createdRoomId, createdRoomName);
                    resetForm();
                  }}
                  className="w-full"
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  }
                >
                  Enter Chat Now
                </Button>
                <p className="text-xs text-anon-500 text-center mt-2">
                  Or share the invite first and enter later
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {currentStep === "create" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-anon-200">
                Start a New Private Chat
              </h3>
              <p className="text-sm text-anon-400">
                Create an encrypted chat room and invite friends
              </p>
            </div>

            <Input
              type="text"
              label="Chat Name (Optional)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Weekend Plans, Study Group..."
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              }
            />

            <Card variant="bordered" className="border-anon-600/50 bg-anon-800/30">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-anon-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div className="text-xs text-anon-300">
                    <strong>Tip:</strong> After creating the chat, you&apos;ll get an invite link to share with friends. They&apos;ll need it to join your encrypted conversation.
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="secure"
                onClick={handleCreateRoom}
                disabled={isLoading}
                loading={isLoading}
                className="flex-1"
              >
                Create Chat
              </Button>
            </div>
          </div>
        )}

        {currentStep === "join" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-anon-200">
                Join a Friend&apos;s Chat
              </h3>
              <p className="text-sm text-anon-400">
                Enter the invite code your friend shared with you
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-anon-200">
                Invite Code
              </label>
              <textarea
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste the invite code here..."
                rows={4}
                className="w-full bg-anon-900 border border-anon-600 text-anon-100 px-3 py-2 rounded-lg focus:outline-none focus:border-phantom-500 focus:ring-2 focus:ring-phantom-500/20 transition-all duration-200 font-mono text-sm"
              />
            </div>

            <Card variant="bordered" className="border-anon-600/50 bg-anon-800/30">
              <CardContent className="p-3">
                <div className="text-xs text-anon-300 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span>📋</span>
                    <span>Paste the text from the QR code or invite link</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>🔗</span>
                    <span>Starts with &quot;anochat://&quot; or similar</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>🔒</span>
                    <span>Creates an encrypted connection automatically</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="phantom"
                onClick={handleJoinRoom}
                disabled={isLoading || !inviteCode.trim()}
                loading={isLoading}
                className="flex-1"
              >
                Join Chat
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 