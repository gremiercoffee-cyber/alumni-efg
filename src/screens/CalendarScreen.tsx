import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  ScrollView,
  State,
} from 'react-native-gesture-handler';
import TopBar from '../components/TopBar';
import { COLORS, EVENT_TYPE_LABELS, FONTS } from '../constants';
import { CalendarEvent, FolderNode } from '../types';
import {
  addDays,
  eventOccursOnDay,
  formatClockTime,
  formatMonthLabel,
  formatShortDate,
  getFolderColor,
  sameDay,
  startOfDay,
  startOfWeek,
  tintColor,
} from '../utils';

type ViewMode = 'day' | 'week' | 'month';

interface Props {
  todoTree: FolderNode;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onRescheduleEvent: (eventId: string, startAt: number, endAt: number, allDay: boolean) => void;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;
const DEFAULT_SCROLL_HOUR = 7;

export default function CalendarScreen({ todoTree, events, onOpenEvent, onRescheduleEvent }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const dayEvents = useMemo(
    () =>
      events
        .filter(event => eventOccursOnDay(event, selectedDate))
        .sort((a, b) => a.startAt - b.startAt),
    [events, selectedDate]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [selectedDate]);

  const title = useMemo(() => {
    if (viewMode === 'day') return formatShortDate(selectedDate.getTime());
    if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return formatMonthLabel(selectedDate);
  }, [selectedDate, viewMode, weekDays]);

  const moveRange = (step: number) => {
    if (viewMode === 'day') setSelectedDate(current => addDays(current, step));
    else if (viewMode === 'week') setSelectedDate(current => addDays(current, step * 7));
    else setSelectedDate(current => new Date(current.getFullYear(), current.getMonth() + step, 1));
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle="Schedule" title={title} />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.navBtn} onPress={() => moveRange(-1)} activeOpacity={0.8}>
          <Text style={styles.navBtnText}>Prev</Text>
        </TouchableOpacity>
        <View style={styles.segmented}>
          {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.segment, viewMode === mode && styles.segmentActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, viewMode === mode && styles.segmentTextActive]}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => moveRange(1)} activeOpacity={0.8}>
          <Text style={styles.navBtnText}>Next</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'day' ? (
        <DayView
          todoTree={todoTree}
          day={selectedDate}
          events={dayEvents}
          onOpenEvent={onOpenEvent}
          onRescheduleEvent={onRescheduleEvent}
        />
      ) : null}

      {viewMode === 'week' ? (
        <ScrollView contentContainerStyle={styles.weekContent}>
          <View style={styles.weekGrid}>
            {weekDays.map(day => {
              const items = events.filter(event => eventOccursOnDay(event, day));
              return (
                <View key={day.toISOString()} style={styles.weekColumn}>
                  <TouchableOpacity
                    style={styles.weekHeader}
                    onPress={() => {
                      setSelectedDate(day);
                      setViewMode('day');
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.weekHeaderLabel}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.weekHeaderDate}>{day.getDate()}</Text>
                  </TouchableOpacity>
                  {items.length === 0 ? <Text style={styles.weekEmpty}>No events</Text> : null}
                  {items.map(event => (
                    <TouchableOpacity
                      key={event.id}
                      style={styles.weekEventWrap}
                      onPress={() => onOpenEvent(event)}
                      activeOpacity={0.82}
                    >
                      <View
                        style={[
                          styles.weekEvent,
                          (() => {
                            const accent = getFolderColor(todoTree, event.categoryFolderId);
                            return accent ? { backgroundColor: tintColor(accent, '33'), borderColor: tintColor(accent, '88') } : null;
                          })(),
                        ]}
                      >
                        <Text style={styles.weekEventTitle} numberOfLines={2}>{event.title}</Text>
                        <Text style={styles.weekEventBadge}>{EVENT_TYPE_LABELS[event.eventType]}</Text>
                        <Text style={styles.weekEventTime}>
                          {event.allDay ? 'All day' : `${formatClockTime(event.startAt)} - ${formatClockTime(event.endAt)}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {viewMode === 'month' ? (
        <ScrollView contentContainerStyle={styles.monthContent}>
          <View style={styles.monthHeaderRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => (
              <Text key={label} style={styles.monthHeaderText}>{label}</Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {monthDays.map(day => {
              const dayEventsCount = events.filter(event => eventOccursOnDay(event, day)).length;
              const inMonth = day.getMonth() === selectedDate.getMonth();
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[styles.monthCell, !inMonth && styles.monthCellMuted]}
                  onPress={() => {
                    setSelectedDate(day);
                    setViewMode('day');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.monthDayLabel, sameDay(day, new Date()) && styles.monthToday]}>
                    {day.getDate()}
                  </Text>
                  {dayEventsCount > 0 ? (
                    <View
                      style={[
                        styles.monthIndicator,
                        (() => {
                          const accent = getFolderColor(todoTree, events.find(event => eventOccursOnDay(event, day))?.categoryFolderId || null);
                          return accent ? { backgroundColor: accent } : null;
                        })(),
                      ]}
                    >
                      <Text style={styles.monthIndicatorText}>{dayEventsCount}</Text>
                    </View>
                  ) : (
                    <View style={styles.monthDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function DayView({
  todoTree,
  day,
  events,
  onOpenEvent,
  onRescheduleEvent,
}: {
  todoTree: FolderNode;
  day: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onRescheduleEvent: (eventId: string, startAt: number, endAt: number, allDay: boolean) => void;
}) {
  const scrollRef = useRef<any>(null);
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const dragRef = useRef<{ eventId: string | null; originalStart: number; duration: number }>({
    eventId: null,
    originalStart: 0,
    duration: 0,
  });
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [previewStartTimes, setPreviewStartTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    console.log('[CalendarDrag] Day view gesture handler mounted');
  }, []);

  const snapDeltaToMinutes = (deltaY: number) => {
    const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
    return Math.round(deltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  };

  const topForTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;
  };

  useEffect(() => {
    const now = new Date();
    const selectedHour = sameDay(day, now)
      ? Math.max(now.getHours() + now.getMinutes() / 60, DEFAULT_SCROLL_HOUR)
      : DEFAULT_SCROLL_HOUR;
    const targetY = Math.max(selectedHour * HOUR_HEIGHT - 4.5 * HOUR_HEIGHT, 0);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [day]);

  const resetDrag = (eventId?: string | null) => {
    dragOffsetY.setValue(0);
    if (eventId) {
      setPreviewStartTimes(current => {
        const next = { ...current };
        delete next[eventId];
        return next;
      });
    }
    dragRef.current = { eventId: null, originalStart: 0, duration: 0 };
    setDraggingEventId(null);
  };

  const applyPreview = (eventId: string, originalStart: number, translationY: number) => {
    const snappedMinutes = snapDeltaToMinutes(translationY);
    const snappedY = (snappedMinutes / 60) * HOUR_HEIGHT;
    const nextStart = originalStart + snappedMinutes * 60 * 1000;
    dragOffsetY.setValue(snappedY);
    setPreviewStartTimes(current => ({
      ...current,
      [eventId]: nextStart,
    }));
  };

  const finishDrag = (
    eventId: string,
    originalStart: number,
    duration: number,
    translationY: number
  ) => {
    const snappedMinutes = snapDeltaToMinutes(translationY);
    const nextStart = originalStart + snappedMinutes * 60 * 1000;
    const nextEnd = nextStart + duration;
    const nextStartDate = new Date(nextStart);
    const nextEndDate = new Date(nextEnd);
    const dropY = topForTimestamp(originalStart) + (snappedMinutes / 60) * HOUR_HEIGHT;

    console.log('[CalendarDrag] END drop', {
      eventId,
      translationY,
      dropY,
      nextStart,
      nextEnd,
      nextTime: `${formatClockTime(nextStart)} - ${formatClockTime(nextEnd)}`,
    });

    resetDrag(eventId);

    if (
      startOfDay(nextStartDate).getTime() !== startOfDay(day).getTime() ||
      startOfDay(nextEndDate).getTime() !== startOfDay(day).getTime()
    ) {
      Alert.alert('Keep this in the current day', 'Drag within the visible day to reschedule the event.');
      return;
    }

    onRescheduleEvent(eventId, nextStart, nextEnd, false);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.dayScroll}
      contentContainerStyle={styles.dayContent}
      keyboardShouldPersistTaps="handled"
    >
      {events.filter(event => event.allDay).length > 0 ? (
        <View style={styles.allDayStrip}>
          <Text style={styles.allDayLabel}>All-day</Text>
          <View style={styles.allDayItems}>
            {events.filter(event => event.allDay).map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.allDayChip}
                onPress={() => onOpenEvent(event)}
                activeOpacity={0.82}
              >
                <Text style={styles.allDayChipText} numberOfLines={1}>{event.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.timeline}>
        {HOURS.map(hour => (
          <View key={hour} style={styles.hourRow}>
            <Text style={styles.hourLabel}>
              {new Date(2020, 0, 1, hour).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {events.filter(event => !event.allDay).map(event => {
          const eventDuration = event.endAt - event.startAt;
          const effectiveStartAt = previewStartTimes[event.id] ?? event.startAt;
          const effectiveEndAt = effectiveStartAt + eventDuration;
          const top = topForTimestamp(effectiveStartAt);
          const height = Math.max((eventDuration / (60 * 60 * 1000)) * HOUR_HEIGHT, HOUR_HEIGHT / 2);
          const isDragging = draggingEventId === event.id;

          return (
            <Animated.View
              key={event.id}
              style={[
                styles.eventBlock,
                (() => {
                  const accent = getFolderColor(todoTree, event.categoryFolderId);
                  return accent
                    ? {
                        backgroundColor: tintColor(accent, 'dd'),
                        borderColor: accent,
                      }
                    : null;
                })(),
                {
                  top,
                  height,
                  opacity: isDragging ? 0.88 : 1,
                  transform: isDragging ? [{ translateY: dragOffsetY }] : undefined,
                  zIndex: isDragging ? 5 : 1,
                  elevation: isDragging ? 6 : 2,
                },
              ]}
            >
              <View style={styles.eventHandleWrap}>
                <PanGestureHandler
                  minDist={2}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  simultaneousHandlers={scrollRef}
                  onGestureEvent={({ nativeEvent }) => {
                    if (dragRef.current.eventId !== event.id) return;
                    applyPreview(event.id, event.startAt, nativeEvent.translationY);
                  }}
                  onHandlerStateChange={({ nativeEvent }) => {
                    if (nativeEvent.state === State.BEGAN) {
                      console.log('[CalendarDrag] BEGAN', { eventId: event.id });
                      dragRef.current = {
                        eventId: event.id,
                        originalStart: event.startAt,
                        duration: eventDuration,
                      };
                      dragOffsetY.setValue(0);
                      setDraggingEventId(event.id);
                    }

                    if (nativeEvent.state === State.ACTIVE) {
                      console.log('[CalendarDrag] ACTIVE', {
                        eventId: event.id,
                        translationY: nativeEvent.translationY,
                      });
                      applyPreview(event.id, event.startAt, nativeEvent.translationY);
                    }

                    if (nativeEvent.state === State.END) {
                      finishDrag(event.id, event.startAt, eventDuration, nativeEvent.translationY);
                    }

                    if (
                      nativeEvent.state === State.CANCELLED ||
                      nativeEvent.state === State.FAILED
                    ) {
                      console.log('[CalendarDrag] CANCELLED', {
                        eventId: event.id,
                        state: nativeEvent.state,
                      });
                      resetDrag(event.id);
                    }
                  }}
                >
                  <View
                    style={styles.eventHandle}
                    onTouchStart={() => console.log('[CalendarDrag] Handle touch detected', { eventId: event.id })}
                  >
                    <Text style={styles.eventHandleText}>|||</Text>
                  </View>
                </PanGestureHandler>
              </View>
              <TouchableOpacity
                style={styles.eventTouch}
                onPress={() => onOpenEvent(event)}
                activeOpacity={0.82}
              >
                <Text style={styles.eventBlockTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.eventTypeBadge}>{EVENT_TYPE_LABELS[event.eventType]}</Text>
                <Text style={styles.eventBlockTime}>
                  {formatClockTime(effectiveStartAt)} - {formatClockTime(effectiveEndAt)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  navBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white50,
  },
  navBtnText: { color: COLORS.brown, fontSize: FONTS.size.xs, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: COLORS.creamLight,
    borderRadius: 18,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
  },
  segmentActive: { backgroundColor: COLORS.brown },
  segmentText: { fontSize: FONTS.size.sm, color: COLORS.brownMid, fontWeight: '600' },
  segmentTextActive: { color: COLORS.bg },
  dayScroll: { flex: 1 },
  dayContent: { padding: 16, paddingBottom: 120 },
  allDayStrip: {
    backgroundColor: COLORS.white50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 12,
    marginBottom: 12,
  },
  allDayLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  allDayItems: { gap: 8 },
  allDayChip: {
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  allDayChipText: { color: COLORS.brown, fontSize: FONTS.size.sm, fontWeight: '600' },
  timeline: { position: 'relative', paddingLeft: 58, height: HOUR_HEIGHT * 24 },
  hourRow: { height: HOUR_HEIGHT, position: 'relative' },
  hourLabel: {
    position: 'absolute',
    left: -58,
    top: -7,
    width: 48,
    textAlign: 'right',
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
  },
  hourLine: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, height: '100%' },
  eventBlock: {
    position: 'absolute',
    left: 6,
    right: 4,
    backgroundColor: '#c96544',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventHandleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  eventHandle: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventHandleText: {
    color: '#fff6ec',
    fontSize: 18,
    fontWeight: '700',
  },
  eventTouch: { flex: 1, padding: 12, paddingLeft: 38 },
  eventBlockTitle: { color: '#fff8f1', fontWeight: '700', fontSize: FONTS.size.sm },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#fff8f1',
    fontSize: 10,
    fontWeight: '700',
  },
  eventBlockTime: { color: '#fff1e8', fontSize: FONTS.size.xs, marginTop: 6 },
  weekContent: { padding: 12, paddingBottom: 120 },
  weekGrid: { gap: 10 },
  weekColumn: {
    backgroundColor: COLORS.white50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  weekHeaderLabel: { color: COLORS.brown, fontSize: FONTS.size.sm, fontWeight: '700' },
  weekHeaderDate: { color: COLORS.brownLight, fontSize: FONTS.size.sm },
  weekEmpty: { color: COLORS.brownFaint, fontSize: FONTS.size.xs },
  weekEventWrap: { marginTop: 8 },
  weekEvent: {
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weekEventTitle: { color: COLORS.brown, fontSize: FONTS.size.sm, fontWeight: '600' },
  weekEventBadge: {
    color: COLORS.brown,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
  weekEventTime: { color: COLORS.brownLight, fontSize: FONTS.size.xs, marginTop: 4 },
  monthContent: { padding: 12, paddingBottom: 120 },
  monthHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  monthHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.brownLight,
    fontSize: 10,
    fontWeight: '700',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthCell: {
    width: '13.4%',
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 8,
    justifyContent: 'space-between',
  },
  monthCellMuted: { opacity: 0.45 },
  monthDayLabel: { color: COLORS.brown, fontWeight: '700', fontSize: FONTS.size.sm },
  monthToday: { color: COLORS.red },
  monthIndicator: {
    alignSelf: 'flex-start',
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.brown,
  },
  monthIndicatorText: { color: COLORS.bg, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  monthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(138, 125, 99, 0.2)',
  },
});
