import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import Badge from '../components/Badge';
import Button from '../components/Button';
import {
  Building2,
  Layers,
  BedDouble,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Info,
  SlidersHorizontal,
  Home,
  Check,
} from 'lucide-react';

export default function HostelOverviewPage() {
  const navigate = useNavigate();
  const { assignedHostel, refreshAssignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE) || hasPermission(PERMISSIONS.PEOPLE_MANAGE);

  // Core Data
  const [hostelData, setHostelData] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [floorsMap, setFloorsMap] = useState({}); // blockId -> floors array
  const [vacantBeds, setVacantBeds] = useState([]);
  const [residents, setResidents] = useState([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Status Change Dialog State
  const [statusModalTarget, setStatusModalTarget] = useState(null); // { type: 'BLOCK'|'FLOOR', item: object }
  const [statusValue, setStatusValue] = useState('ACTIVE');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Load complete authorized hostel overview
  const loadHostelOverview = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // 1. Fetch assigned hostel record
        const hostel = await inchargeService.getMyHostel();
        setHostelData(hostel);

        const hostelId = hostel?.id || hostel?.hostel_id || assignedHostel?.id;
        if (!hostelId) {
          throw new Error('No assigned hostel found for the authenticated In-Charge.');
        }

        // 2. Parallel fetch blocks, vacant beds, and resident roster (for authoritative metrics)
        const [blocksRes, vacantBedsRes, residentsRes] = await Promise.allSettled([
          inchargeService.getBlocks(hostelId),
          inchargeService.getVacantBeds(hostelId),
          inchargeService.getHostelResidents(hostelId),
        ]);

        const rawBlocks = blocksRes.status === 'fulfilled' ? blocksRes.value : [];
        const rawVacant = vacantBedsRes.status === 'fulfilled' ? vacantBedsRes.value : [];
        const rawResidents = residentsRes.status === 'fulfilled' ? residentsRes.value : [];

        const validBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
        setBlocks(validBlocks);
        setVacantBeds(Array.isArray(rawVacant) ? rawVacant : []);
        setResidents(Array.isArray(rawResidents) ? rawResidents : []);

        // Default to first block if available
        if (validBlocks.length > 0) {
          const initialBlock = selectedBlock
            ? validBlocks.find((b) => b.id === selectedBlock.id) || validBlocks[0]
            : validBlocks[0];
          setSelectedBlock(initialBlock);

          // Fetch floors for this initial block
          const floors = await inchargeService.getFloors(hostelId, initialBlock.id);
          setFloorsMap((prev) => ({
            ...prev,
            [initialBlock.id]: Array.isArray(floors) ? floors : [],
          }));
        }
      } catch (err) {
        console.error('Hostel overview loading error:', err);
        setError(err.message || 'Failed to load assigned hostel overview and structure.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assignedHostel, selectedBlock]
  );

  useEffect(() => {
    loadHostelOverview(false);
  }, []);

  // Handle selecting a block and loading its floors on demand
  const handleSelectBlock = async (block) => {
    setSelectedBlock(block);
    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    if (!floorsMap[block.id] && hostelId) {
      try {
        setLoadingFloors(true);
        const floors = await inchargeService.getFloors(hostelId, block.id);
        setFloorsMap((prev) => ({
          ...prev,
          [block.id]: Array.isArray(floors) ? floors : [],
        }));
      } catch (err) {
        console.error('Failed to load floors for block:', err);
      } finally {
        setLoadingFloors(false);
      }
    }
  };

  // Operational Status update submission
  const handleStatusSubmit = async () => {
    if (!statusModalTarget) return;
    setStatusSubmitting(true);
    setStatusError(null);

    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    try {
      if (statusModalTarget.type === 'BLOCK') {
        await inchargeService.updateBlockStatus(hostelId, statusModalTarget.item.id, statusValue);
        setSuccessBanner(`Block "${statusModalTarget.item.name}" status updated to ${statusValue}.`);
      } else if (statusModalTarget.type === 'FLOOR') {
        await inchargeService.updateFloorStatus(
          hostelId,
          selectedBlock.id,
          statusModalTarget.item.id,
          statusValue
        );
        setSuccessBanner(`Floor "${statusModalTarget.item.name}" status updated to ${statusValue}.`);
      }
      setStatusModalTarget(null);
      // Reload overview to update state
      await loadHostelOverview(true);
    } catch (err) {
      console.error('Status update failed:', err);
      setStatusError(err.response?.data?.message || err.message || 'Failed to update operational status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const activeHostel = hostelData || assignedHostel;
  const currentFloors = selectedBlock ? floorsMap[selectedBlock.id] || [] : [];

  // Authoritative Derived Aggregates
  const totalCapacity = Number(activeHostel?.total_capacity || activeHostel?.capacity || 0);
  const totalBlocksCount = Number(activeHostel?.total_blocks || blocks.length || 0);
  const totalRoomsCount = Number(activeHostel?.total_rooms || 0);
  const vacantBedsCount = vacantBeds.length;
  const occupiedBedsCount = residents.length;
  const occupancyPercentage =
    totalCapacity > 0 ? Math.min(100, Math.round((occupiedBedsCount / totalCapacity) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title="Hostel Overview & Hierarchy"
        description="Comprehensive premises overview, architectural blocks, floors, and authoritative capacity telemetry."
        icon={Building2}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadHostelOverview(true)}
              loading={refreshing}
            >
              Sync Hierarchy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={BedDouble}
              onClick={() => navigate('/rooms')}
            >
              Room & Bed Operations
            </Button>
          </div>
        }
      />

      {/* Success Notification */}
      {successBanner && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--success-text)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Ownership Boundary Notice */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1e40af',
          fontSize: '0.85rem',
        }}
      >
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Premises Master Data:</strong> Hostel structures, block definitions, and capacity are configured by
          College Administration. Hostel In-Charges possess operational oversight, real-time telemetry, and operational status maintenance scope.
        </div>
      </div>

      {loading && <LoadingState title="Loading Hostel Architecture..." rows={4} />}
      {error && (
        <ErrorState
          title="Unable to Retrieve Hostel Hierarchy"
          message={error}
          onRetry={() => loadHostelOverview(false)}
        />
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Hostel Identity & KPI Stat Bar */}
          <div className="card" style={{ padding: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                paddingBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={30} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {activeHostel?.name || activeHostel?.hostel_name || 'Assigned Hostel'}
                    </h2>
                    <Badge variant={activeHostel?.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {activeHostel?.status || 'ACTIVE'}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Code: <strong>{activeHostel?.code || activeHostel?.hostel_code || '—'}</strong> • Gender Category:{' '}
                    <strong>{activeHostel?.gender_category || activeHostel?.hostel_type || 'Standard'}</strong> • Assigned In-Charge:{' '}
                    <strong>{activeHostel?.staff_name || 'Assigned'}</strong>
                  </p>
                </div>
              </div>

              {/* Occupancy Indicator Bar */}
              <div
                style={{
                  minWidth: '220px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Live Occupancy</span>
                  <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{occupancyPercentage}%</span>
                </div>
                <div
                  style={{
                    height: '8px',
                    width: '100%',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${occupancyPercentage}%`,
                      backgroundColor: occupancyPercentage > 90 ? 'var(--danger-text)' : 'var(--primary-color)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  {occupiedBedsCount} of {totalCapacity} Beds Occupied
                </div>
              </div>
            </div>

            {/* Authoritative Metric KPI Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Blocks</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {totalBlocksCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Configured wings</div>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Design Capacity</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {totalCapacity}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total approved bed count</div>
              </div>

              {totalRoomsCount > 0 && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Rooms</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {totalRoomsCount}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered rooms</div>
                </div>
              )}

              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Vacant Beds</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                  {vacantBedsCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#166534' }}>Ready for assignment</div>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>Active Residents</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                  {occupiedBedsCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#1e40af' }}>Allocated residents</div>
              </div>
            </div>
          </div>

          {/* Interactive Block & Floor Hierarchy Navigator */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Premises Architectural Hierarchy
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Navigate blocks and explore active floors, operational statuses, and room layouts.
                </p>
              </div>
            </div>

            {blocks.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Blocks Registered"
                message="No architectural blocks have been provisioned for this hostel by College Administration."
              />
            ) : (
              <div>
                {/* Block Selector Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '20px',
                  }}
                >
                  {blocks.map((block) => {
                    const isSelected = selectedBlock?.id === block.id;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => handleSelectBlock(block)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                          color: isSelected ? 'var(--primary-color)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Building2 size={16} />
                        <span>{block.name}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? 'var(--primary-color)' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                          }}
                        >
                          {block.code}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Block Profile & Floors List */}
                {selectedBlock && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#f8fafc',
                        padding: '14px 18px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '18px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                            Block {selectedBlock.name} ({selectedBlock.code})
                          </span>
                          <Badge variant={selectedBlock.status === 'ACTIVE' ? 'success' : 'warning'}>
                            {selectedBlock.status || 'ACTIVE'}
                          </Badge>
                        </div>
                        {selectedBlock.description && (
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {selectedBlock.description}
                          </p>
                        )}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Capacity: <strong>{selectedBlock.total_capacity || '—'}</strong>
                        </div>
                      </div>

                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={SlidersHorizontal}
                          onClick={() => {
                            setStatusModalTarget({ type: 'BLOCK', item: selectedBlock });
                            setStatusValue(selectedBlock.status || 'ACTIVE');
                          }}
                        >
                          Update Status
                        </Button>
                      )}
                    </div>

                    {/* Floor List for Selected Block */}
                    <h4
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Layers size={16} />
                      Configured Floors ({currentFloors.length})
                    </h4>

                    {loadingFloors ? (
                      <LoadingState title="Loading Floors..." rows={2} />
                    ) : currentFloors.length === 0 ? (
                      <EmptyState
                        icon={Layers}
                        title="No Floors Registered"
                        message={`No floor records were found in Block ${selectedBlock.name}.`}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                          gap: '14px',
                        }}
                      >
                        {currentFloors.map((floor) => (
                          <div
                            key={floor.id}
                            style={{
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px',
                              padding: '16px',
                              backgroundColor: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: 'var(--shadow-sm)',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem' }}>
                                  {floor.name}
                                </span>
                                <Badge variant={floor.status === 'ACTIVE' ? 'success' : 'warning'}>
                                  {floor.status || 'ACTIVE'}
                                </Badge>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Floor Code: <strong>{floor.code}</strong> • Number: <strong>{floor.floor_number ?? '—'}</strong>
                              </p>
                              {floor.description && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                  {floor.description}
                                </p>
                              )}
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                Total Capacity: <strong>{floor.total_capacity || '—'}</strong>
                              </div>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '16px',
                                paddingTop: '12px',
                                borderTop: '1px solid #f1f5f9',
                              }}
                            >
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatusModalTarget({ type: 'FLOOR', item: floor });
                                    setStatusValue(floor.status || 'ACTIVE');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Update Status
                                </button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ArrowRight}
                                onClick={() =>
                                  navigate(`/rooms?blockId=${selectedBlock.id}&floorId=${floor.id}`)
                                }
                              >
                                View Rooms
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operational Status Update Modal */}
      <Modal
        isOpen={Boolean(statusModalTarget)}
        onClose={() => setStatusModalTarget(null)}
        title={`Update ${statusModalTarget?.type === 'BLOCK' ? 'Block' : 'Floor'} Operational Status`}
        subtitle={`Target: ${statusModalTarget?.item?.name || 'Selected Item'}`}
        maxWidth="460px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusModalTarget(null)}
              disabled={statusSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleStatusSubmit}
              loading={statusSubmitting}
            >
              Apply Status
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {statusError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {statusError}
            </div>
          )}

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Adjust the operational condition of this architectural unit. When marked as <strong>MAINTENANCE</strong> or{' '}
            <strong>INACTIVE</strong>, administrative warnings are surfaced during allocation checks.
          </p>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Select Operational Status:
            </label>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
              }}
            >
              <option value="ACTIVE">ACTIVE (Fully Operational)</option>
              <option value="MAINTENANCE">MAINTENANCE (Under Repair / Cleaning)</option>
              <option value="INACTIVE">INACTIVE (Not in Active Use)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
