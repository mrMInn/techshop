"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { 
  getLeadSourcesAction, 
  createLeadSourceAction, 
  updateLeadSourceAction, 
  deleteLeadSourceAction 
} from "@/app/actions/orders";
import { Trash2, Plus, Edit2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface LeadSource {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface LeadSourceManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadSourceManagerDialog({
  isOpen,
  onClose,
  onUpdate
}: LeadSourceManagerDialogProps) {
  const [leadSourcesList, setLeadSourcesList] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog con để thêm/sửa và xác nhận xóa
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadLeadSources = async () => {
    setLoading(true);
    try {
      const data = await getLeadSourcesAction();
      setLeadSourcesList(data as any);
    } catch (error) {
      toast.error("Lỗi lấy danh sách nguồn khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLeadSources();
    }
  }, [isOpen]);

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      const res = await deleteLeadSourceAction(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadLeadSources();
        onUpdate();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa nguồn khách hàng");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    loadLeadSources();
    onUpdate();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Quản lý Nguồn khách"
        size="xl"
      >
        <div className="space-y-4">
          {/* Header với tổng số lượng và nút thêm mới */}
          <div className="flex justify-between items-center pb-2 border-b border-[#e0e0e0]">
            <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
              Tổng số nguồn khách: {leadSourcesList.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingSource(null);
                setIsFormOpen(true);
              }}
              className="h-[38px] px-4 rounded-full bg-[#0066cc] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              Thêm nguồn khách mới
            </button>
          </div>

          {/* Danh sách các nguồn khách */}
          {loading && leadSourcesList.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#7a7a7a]">
              <Loader2 size={24} className="animate-spin text-[#0066cc] mb-2" />
              <span className="text-[14px]">Đang tải danh sách...</span>
            </div>
          ) : leadSourcesList.length === 0 ? (
            <div className="p-16 text-center text-[#7a7a7a]">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus size={20} className="text-slate-400" />
              </div>
              <p className="text-[15px]">Chưa có nguồn khách hàng nào.</p>
            </div>
          ) : (
            <div className="max-h-[390px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {leadSourcesList.map((source, index) => {
                return (
                  <div
                    key={source.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Vòng tròn STT */}
                      <div className="w-10 h-10 rounded-full border border-[#e0e0e0] bg-white flex items-center justify-center text-[14px] font-bold text-[#0066cc] shrink-0 shadow-sm">
                        {index + 1}
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-[#1d1d1f] truncate leading-tight">
                          {source.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSource(source);
                          setIsFormOpen(true);
                        }}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-[#0066cc]/10 text-[#7a7a7a] hover:text-[#0066cc] flex items-center justify-center transition-all cursor-pointer shadow-sm border border-[#e0e0e0]/50"
                        title="Sửa nguồn khách"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(source.id, source.name)}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-red-50 text-[#7a7a7a] hover:text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm border border-[#e0e0e0]/50"
                        title="Xóa nguồn khách"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>

      {/* Xác nhận xóa */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa nguồn khách"
        description={`Bạn có chắc chắn muốn xóa nguồn khách "${itemToDelete?.name}"? Thao tác này sẽ gỡ liên kết nguồn này khỏi toàn bộ khách hàng và đơn hàng liên quan.`}
        confirmText="Xóa nguồn khách"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />

      {/* Form chi tiết Thêm/Sửa */}
      <LeadSourceDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSource(null);
        }}
        leadSource={editingSource}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

// ============================================================
// HỘP THOẠI THÊM/SỬA CHI TIẾT NGUỒN KHÁCH HÀNG (LeadSourceDialog)
// ============================================================

interface LeadSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  leadSource: LeadSource | null;
  onSuccess: () => void;
}

export function LeadSourceDialog({
  isOpen,
  onClose,
  leadSource,
  onSuccess
}: LeadSourceDialogProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!leadSource;

  useEffect(() => {
    if (isOpen) {
      if (leadSource) {
        setName(leadSource.name);
      } else {
        setName("");
      }
    }
  }, [isOpen, leadSource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên nguồn khách");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        const res = await updateLeadSourceAction(leadSource.id, {
          name: name.trim()
        });
        if (res.success) {
          toast.success(res.message);
          onSuccess();
          onClose();
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createLeadSourceAction({
          name: name.trim()
        });
        if (res.success) {
          toast.success(res.message);
          onSuccess();
          onClose();
        } else {
          toast.error(res.message);
        }
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi lưu nguồn khách");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Sửa nguồn khách" : "Thêm nguồn khách mới"}
      description={isEditing ? "Chỉnh sửa thông tin chi tiết cho nguồn khách này." : "Tạo nguồn tiếp cận khách hàng mới trong hệ thống."}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        
        {/* Tên nguồn */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-[#1d1d1f]">
            Tên nguồn khách hàng *
          </label>
          <input
            type="text"
            required
            placeholder="Ví dụ: TikTok Shop, Zalo Group, Group VOZ..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="w-full px-4 h-[44px] rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
          />
        </div>

        {/* Nút lưu/hủy */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e0e0] mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 h-[44px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[14px] font-semibold text-[#1d1d1f] rounded-full transition-all cursor-pointer active:scale-95 duration-200"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 h-[44px] bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[14px] font-semibold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200 flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isEditing ? (
              <Check size={15} />
            ) : (
              <Plus size={15} />
            )}
            <span>{isEditing ? "Lưu thay đổi" : "Tạo nguồn mới"}</span>
          </button>
        </div>

      </form>
    </Dialog>
  );
}
