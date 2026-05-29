"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Users, Loader2, Trash2, UserPlus } from "lucide-react";

interface MemberRow {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE";
  role: "member";
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: string;
}

interface TeamData {
  isOwner: boolean;
  owner: { email: string; name: string | null };
  members: MemberRow[];
}

export default function EstablishmentTeamAccess({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTeam = useCallback(() => {
    fetch(`/api/establishments/${establishmentId}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members !== undefined) {
          setTeam(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [establishmentId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/establishments/${establishmentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка приглашения");
        return;
      }
      setInviteEmail("");
      setSuccess(
        data.member?.status === "PENDING"
          ? "Приглашение отправлено на email"
          : "Пользователю открыт доступ"
      );
      loadTeam();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Удалить доступ этого пользователя?")) return;
    setRemoving(memberId);
    setError("");
    try {
      const res = await fetch(
        `/api/establishments/${establishmentId}/members/${memberId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка");
        return;
      }
      loadTeam();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-gray-500 py-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          Загрузка доступа...
        </div>
      </Card>
    );
  }

  if (!team) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-900">Доступ команды</h2>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-indigo-50 border border-indigo-100">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {team.owner.name || team.owner.email}
            </p>
            <p className="text-xs text-gray-500">{team.owner.email}</p>
          </div>
          <Badge variant="info">Владелец</Badge>
        </div>

        {team.members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{m.email}</p>
              <p className="text-xs text-gray-500">
                {m.status === "PENDING"
                  ? "Ожидает регистрации"
                  : `Активен${m.acceptedAt ? ` · ${new Date(m.acceptedAt).toLocaleDateString("ru-RU")}` : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={m.status === "ACTIVE" ? "success" : "warning"}>
                {m.status === "ACTIVE" ? "Активен" : "Ожидание"}
              </Badge>
              {team.isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  disabled={removing === m.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  title="Удалить доступ"
                >
                  {removing === m.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {team.members.length === 0 && (
          <p className="text-sm text-gray-500 py-2">
            Пока нет приглашённых участников. Добавьте email коллеги с доступом к кабинету.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-3">{success}</div>
      )}

      {team.isOwner ? (
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <Input
            label="Пригласить по email"
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="flex-1"
          />
          <div className="sm:pt-6">
            <Button type="submit" disabled={inviting}>
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Пригласить
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500">
          Управлять доступом может только владелец заведения.
        </p>
      )}
    </Card>
  );
}
