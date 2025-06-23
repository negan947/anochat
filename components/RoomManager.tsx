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

interface RoomManagerProps {
  identity: IdentityKey;
  onRoomJoined: (roomId: string, roomName?: string) => void;
}

export default function RoomManager({ identity, onRoomJoined }: RoomManagerProps) {
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [currentStep, setCurrentStep] = useState<"list" | "create" | "join">("list");
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<string>("");
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      
      // Save room to storage
      await storage.saveRoom(
        roomId,
        roomName || undefined,
        [identity.fingerprint]
      );

      // Generate room invite
      const invite = await generateRoomInvite(identity, roomId, roomName || undefined);
      setGeneratedInvite(invite.qrCode);
      
      await loadActiveRooms();
      setCurrentStep("list");
      
      // Auto-join the created room
      onRoomJoined(roomId, roomName || undefined);
      
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
      
      // Parse invite code (could be QR data or link)
      if (inviteCode.startsWith("anochat://")) {
        invite = await parseKeyExchangeLink(inviteCode);
      } else {
        invite = await parseKeyExchangeQR(inviteCode);
      }

      // Validate invite
      if (!invite.preKeyBundle || !invite.senderFingerprint) {
        throw new Error("Invalid invite format");
      }

      // Process the pre-key bundle to establish session
      await processPreKeyBundle(
        invite.senderFingerprint,
        1, // device ID
        invite.preKeyBundle
      );

      // Save room if provided
      if (invite.roomId) {
        await storage.saveRoom(
          invite.roomId,
          undefined, // No room name in invite
          [identity.fingerprint, invite.senderFingerprint]
        );
        
        await loadActiveRooms();
        onRoomJoined(invite.roomId, undefined);
      }

      setCurrentStep("list");
      resetForm();
      
    } catch {
      setError(`Failed to join room`);
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
    setShowQR(false);
    setError("");
  };

  const copyInviteToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedInvite);
      // Could add toast notification here
    } catch {
      setError("Failed to copy invite");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-6 text-center">
        Room Manager
      </h2>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {currentStep === "list" && (
        <div className="space-y-4">
          {/* Active Rooms */}
          {activeRooms.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Active Rooms</h3>
              <div className="space-y-2 mb-4">
                {activeRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleJoinExistingRoom(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-200">
                          {room.name || "Unnamed Room"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {room.participants.length} participant(s)
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(room.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCurrentStep("create")}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={() => setCurrentStep("join")}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              Join Room
            </button>
          </div>

          {/* Show Generated Invite */}
          {generatedInvite && (
            <div className="bg-gray-700 rounded-lg p-4 mt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Room Created!</h3>
              <p className="text-xs text-gray-400 mb-3">Share this invite with others:</p>
              
              <div className="flex space-x-2 mb-3">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="text-green-400 hover:text-green-300"
                  title="Show QR code"
                >
                  📱 QR
                </button>
                <button
                  onClick={copyInviteToClipboard}
                  className="text-blue-400 hover:text-blue-300"
                  title="Copy invite"
                >
                  📋 Copy
                </button>
              </div>

                             {showQR && (
                 <div className="bg-white p-3 rounded text-center">
                   <QRCode
                     value={generatedInvite}
                     size={120}
                   />
                 </div>
               )}
              
              <button
                onClick={() => setGeneratedInvite("")}
                className="text-xs text-gray-400 hover:text-gray-300 mt-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === "create" && (
        <div className="space-y-4">
          <div className="text-center text-gray-300 text-sm mb-4">
            Create a new encrypted room
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name (Optional)
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-xs text-gray-400 bg-gray-900 p-3 rounded">
            <strong>Note:</strong> You&apos;ll receive a shareable invite link after creation.
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setCurrentStep("list");
                resetForm();
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              {isLoading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </div>
      )}

      {currentStep === "join" && (
        <div className="space-y-4">
          <div className="text-center text-gray-300 text-sm mb-4">
            Join an existing room
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Invite Code or Link
            </label>
            <textarea
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste invite code, QR data, or link here..."
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-xs text-gray-400 bg-gray-900 p-3 rounded">
            <strong>Supported formats:</strong>
            <br />• QR code data (scanned text)
            <br />• anochat:// links
            <br />• Invite codes from other users
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setCurrentStep("list");
                resetForm();
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinRoom}
              disabled={isLoading || !inviteCode.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              {isLoading ? "Joining..." : "Join Room"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 