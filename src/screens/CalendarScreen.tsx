import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
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
import { CalendarEvent, FolderNode, TodoList } from '../types';
import {
  addDays,
  eventOccursOnDay,
  flattenFolders,
  formatClockTime,
  formatMonthLabel,
  formatShortDate,
  folderPathLabel,
  getFolderColor,
  sameDay,
  startOfDay,
  startOfWeek,
  tintColor,
} from '../utils';

type ViewMode = 'day' | 'week' | 'month';

interface Props {
  todoTree: FolderNode;
  todoLists: TodoList[];
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onToggleEventDone: (eventId: string) => void | Promise<void>;
  onRescheduleEvent: (eventId: string, startAt: number, endAt: number, allDay: boolean) => void;
  onDeleteEvent: (eventId: string) => void | Promise<void>;
  onDeleteEventAndTodo: (eventId: string) => void | Promise<void>;
  onOpenLinkedTodo: (eventId: string) => void;
  onUpdateEvent: (eventId: string, title: string, startAt: number, endAt: number, eventType: CalendarEvent['eventType']) => void;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;
const DEFAULT_SCROLL_HOUR = 7;

export default function CalendarScreen({
  todoTree,
  todoLists,
  events,
  onOpenEvent,
  onToggleEventDone,
  onRescheduleEvent,
  onDeleteEvent,
  onDeleteEventAndTodo,
  onOpenLinkedTodo,
  onUpdateEvent,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = events.find(event => event.id === selectedEventId) || null;
  const folderList = useMemo(() => flattenFolders(todoTree), [todoTree]);

  const linkedTodoForEvent = (eventId: string) => {
    const event = events.find(entry => entry.id === eventId);
    if (event?.todoListId && event.todoItemId) {
      const list = todoLists.find(entry => entry.id === event.todoListId);
      const item = list?.items.find(entry => entry.id === event.todoItemId);
      if (list && item) return { list, item };
    }
    for (const list of todoLists) {
      const item = list.items.find(entry => entry.eventId === eventId);
      if (item) return { list, item };
    }
    return null;
  };

  const confirmDeleteEvent = (event: CalendarEvent) => {
    Alert.alert('Delete this event?', event.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete event',
        style: 'destructive',
        onPress: () => {
          setSelectedEventId(null);
          onDeleteEvent(event.id);
        },
      },
    ]);
  };

  const confirmDeleteEventAndTodo = (event: CalendarEvent) => {
    Alert.alert('Delete this event and its to-do item?', event.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete both',
        style: 'destructive',
        onPress: () => {
          setSelectedEventId(null);
          onDeleteEventAndTodo(event.id);
        },
      },
    ]);
  };

  const showQuickActions = (event: CalendarEvent) => {
    const linkedTodo = linkedTodoForEvent(event.id);
    Alert.alert(event.title, 'Choose an action', [
      { text: event.done ? 'Mark not done' : 'Mark done', onPress: () => onToggleEventDone(event.id) },
      { text: 'Edit time', onPress: () => setSelectedEventId(event.id) },
      { text: 'Delete event', style: 'destructive', onPress: () => confirmDeleteEvent(event) },
      ...(linkedTodo
        ? [{ text: 'Delete event + to-do', style: 'destructive' as const, onPress: () => confirmDeleteEventAndTodo(event) }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
          todoLists={todoLists}
          day={selectedDate}
          events={dayEvents}
          onOpenEvent={event => {
            onOpenEvent(event);
            setSelectedEventId(event.id);
          }}
          onLongPressEvent={showQuickActions}
          onToggleEventDone={onToggleEventDone}
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
                      onPress={() => {
                        onOpenEvent(event);
                        setSelectedEventId(event.id);
                      }}
                      onLongPress={() => showQuickActions(event)}
                      delayLongPress={260}
                      activeOpacity={0.82}
                    >
                      <View
                        style={[
                          styles.weekEvent,
                          (() => {
                            const accent = getFolderColor(todoTree, event.categoryFolderId);
                            return accent ? { backgroundColor: tintColor(accent, '33'), borderColor: tintColor(accent, '88') } : null;
                          })(),
                          event.done && styles.weekEventDone,
                        ]}
                      >
                        <View style={styles.weekEventTitleRow}>
                          <TouchableOpacity
                            style={[styles.eventCheckbox, event.done && styles.eventCheckboxDone]}
                            onPress={pressEvent => {
                              pressEvent.stopPropagation();
                              onToggleEventDone(event.id);
                            }}
                            activeOpacity={0.75}
                          >
                            {event.done ? <Text style={styles.eventCheckmark}>x</Text> : null}
                          </TouchableOpacity>
                          <Text style={[styles.weekEventTitle, event.done && styles.eventTitleDone]} numberOfLines={2}>
                            {event.title}
                          </Text>
                        </View>
                        <Text style={styles.weekEventBadge}>
                          {EVENT_TYPE_LABELS[event.eventType]}
                          {(() => { const list = todoLists.find(l => l.id === event.todoListId); return list ? ` · ${list.title}` : ''; })()}
                        </Text>
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
              const dayItems = events.filter(event => eventOccursOnDay(event, day));
              const dayEventsCount = dayItems.length;
              const allDone = dayEventsCount > 0 && dayItems.every(event => event.done);
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
                          if (allDone) return { backgroundColor: COLORS.brownFaint };
                          const accent = getFolderColor(todoTree, dayItems[0]?.categoryFolderId || null);
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
      <EventDetailModal
        event={selectedEvent}
        linkedTodo={selectedEvent ? linkedTodoForEvent(selectedEvent.id) : null}
        categoryLabel={
          selectedEvent?.categoryFolderId ? folderPathLabel(selectedEvent.categoryFolderId, folderList) : 'None'
        }
        onClose={() => setSelectedEventId(null)}
        onOpenLinkedTodo={() => {
          if (!selectedEvent) return;
          setSelectedEventId(null);
          onOpenLinkedTodo(selectedEvent.id);
        }}
        onToggleEventDone={eventId => onToggleEventDone(eventId)}
        onDeleteEvent={event => confirmDeleteEvent(event)}
        onDeleteEventAndTodo={event => confirmDeleteEventAndTodo(event)}
        onSaveEdits={(eventId, title, startAt, endAt, eventType) =>
          onUpdateEvent(eventId, title, startAt, endAt, eventType)
        }
      />
    </View>
  );
}

function DayView({
  todoTree,
  todoLists,
  day,
  events,
  onOpenEvent,
  onLongPressEvent,
  onToggleEventDone,
  onRescheduleEvent,
}: {
  todoTree: FolderNode;
  todoLists: TodoList[];
  day: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onLongPressEvent: (event: CalendarEvent) => void;
  onToggleEventDone: (eventId: string) => void | Promise<void>;
  onRescheduleEvent: (eventId: string, startAt: number, endAt: number, allDay: boolean) => void;
}) {
  const getListName = (event: CalendarEvent): string | null => {
    if (!event.todoListId) return null;
    return todoLists.find(l => l.id === event.todoListId)?.title || null;
  };
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
                style={[styles.allDayChip, event.done && styles.allDayChipDone]}
                onPress={() => onOpenEvent(event)}
                onLongPress={() => onLongPressEvent(event)}
                delayLongPress={260}
                activeOpacity={0.82}
              >
                <TouchableOpacity
                  style={[styles.eventCheckbox, event.done && styles.eventCheckboxDone]}
                  onPress={pressEvent => {
                    pressEvent.stopPropagation();
                    onToggleEventDone(event.id);
                  }}
                  activeOpacity={0.75}
                >
                  {event.done ? <Text style={styles.eventCheckmark}>x</Text> : null}
                </TouchableOpacity>
                <Text style={[styles.allDayChipText, event.done && styles.eventTitleDone]} numberOfLines={1}>
                  {event.title}
                </Text>
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
          const top = topForTimestamp(event.startAt);
          const height = Math.max((eventDuration / (60 * 60 * 1000)) * HOUR_HEIGHT, HOUR_HEIGHT / 2);
          const isDragging = draggingEventId === event.id;

          return (
            <React.Fragment key={event.id}>
              {isDragging ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.eventBlock,
                    styles.eventGhost,
                    {
                      top,
                      height,
                    },
                  ]}
                />
              ) : null}
            <Animated.View
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
                event.done && styles.eventBlockDone,
                {
                  top,
                  height,
                  opacity: isDragging ? 0.94 : 1,
                  transform: isDragging ? [{ translateY: dragOffsetY }] : undefined,
                  zIndex: isDragging ? 5 : 1,
                  elevation: isDragging ? 6 : 2,
                },
              ]}
            >
              <View style={styles.eventHandleWrap}>
                <PanGestureHandler
                  minDist={2}
                  activateAfterLongPress={200}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                onLongPress={() => onLongPressEvent(event)}
                delayLongPress={260}
                activeOpacity={0.82}
              >
                <View style={styles.eventTitleRow}>
                  <TouchableOpacity
                    style={[styles.eventCheckbox, styles.eventCheckboxLight, event.done && styles.eventCheckboxDone]}
                    onPress={pressEvent => {
                      pressEvent.stopPropagation();
                      onToggleEventDone(event.id);
                    }}
                    activeOpacity={0.75}
                  >
                    {event.done ? <Text style={styles.eventCheckmark}>x</Text> : null}
                  </TouchableOpacity>
                  <Text style={[styles.eventBlockTitle, event.done && styles.eventBlockTitleDone]} numberOfLines={2}>
                    {event.title}
                  </Text>
                </View>
                <Text style={styles.eventTypeBadge}>
                  {EVENT_TYPE_LABELS[event.eventType]}{getListName(event) ? ` · ${getListName(event)}` : ''}
                </Text>
                <Text style={styles.eventBlockTime}>
                  {formatClockTime(effectiveStartAt)} - {formatClockTime(effectiveEndAt)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
}

const EVENT_TYPES: CalendarEvent['eventType'][] = [
  'meeting', 'reminder', 'task', 'appointment', 'personal', 'delivery', 'shiur', 'other',
];

const STEP_MS = 15 * 60 * 1000;

function EventDetailModal({
  event,
  linkedTodo,
  categoryLabel,
  onClose,
  onOpenLinkedTodo,
  onToggleEventDone,
  onDeleteEvent,
  onDeleteEventAndTodo,
  onSaveEdits,
}: {
  event: CalendarEvent | null;
  linkedTodo: { list: TodoList; item: TodoList['items'][number] } | null;
  categoryLabel: string;
  onClose: () => void;
  onOpenLinkedTodo: () => void;
  onToggleEventDone: (eventId: string) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  onDeleteEventAndTodo: (event: CalendarEvent) => void;
  onSaveEdits: (eventId: string, title: string, startAt: number, endAt: number, eventType: CalendarEvent['eventType']) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(0);
  const [draftType, setDraftType] = useState<CalendarEvent['eventType']>('task');

  // Reset edit state whenever a new event opens
  useEffect(() => {
    if (event) {
      setEditing(false);
      setDraftTitle(event.title);
      setDraftStart(event.startAt);
      setDraftEnd(event.endAt);
      setDraftType(event.eventType);
    }
  }, [event?.id]);

  if (!event) return null;

  const dateLabel = new Date(event.startAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });

  const saveAndClose = () => {
    onSaveEdits(event.id, draftTitle.trim() || event.title, draftStart, draftEnd, draftType);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraftTitle(event.title);
    setDraftStart(event.startAt);
    setDraftEnd(event.endAt);
    setDraftType(event.eventType);
    setEditing(false);
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={editing ? cancelEdit : onClose}>
      <View style={styles.detailScrim}>
        <TouchableOpacity style={styles.detailDismissArea} activeOpacity={1} onPress={editing ? cancelEdit : onClose} />
        <View style={styles.detailSheet}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleWrap}>
              {editing ? (
                <TextInput
                  style={styles.detailTitleInput}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  autoFocus
                  multiline
                  returnKeyType="done"
                />
              ) : (
                <>
                  <Text style={styles.detailEyebrow}>{EVENT_TYPE_LABELS[event.eventType]}</Text>
                  <Text style={styles.detailTitle}>{event.title}</Text>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.detailCloseBtn} onPress={editing ? cancelEdit : onClose} activeOpacity={0.8}>
              <Text style={styles.detailCloseText}>x</Text>
            </TouchableOpacity>
          </View>

          {/* Read mode info rows */}
          {!editing ? (
            <View style={styles.detailRows}>
              <Text style={styles.detailRowText}>Date: {dateLabel}</Text>
              <Text style={styles.detailRowText}>
                Time: {event.allDay ? 'All day' : `${formatClockTime(event.startAt)} – ${formatClockTime(event.endAt)}`}
              </Text>
              <Text style={styles.detailRowText}>Category: {categoryLabel}</Text>
              <TouchableOpacity
                style={styles.detailStatusRow}
                onPress={() => onToggleEventDone(event.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.detailRowText}>Status: {event.done ? 'Done ✓' : 'Open'}</Text>
                <Text style={styles.detailStatusToggle}>{event.done ? 'Mark open' : 'Mark done'}</Text>
              </TouchableOpacity>
              {linkedTodo ? (
                <TouchableOpacity style={styles.linkedTodoRow} onPress={onOpenLinkedTodo} activeOpacity={0.82}>
                  <Text style={styles.linkedTodoText}>To-do list: {linkedTodo.list.title}</Text>
                  <Text style={styles.linkedTodoHint}>Open linked to-do →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.detailRowText}>To-do list: Not linked</Text>
              )}
            </View>
          ) : (
            /* Edit mode fields */
            <View style={styles.detailEditFields}>
              {/* Time editing */}
              <Text style={styles.editFieldLabel}>Start time</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity style={styles.timeStepBtn} onPress={() => setDraftStart(s => s - STEP_MS)} activeOpacity={0.75}>
                  <Text style={styles.timeStepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.timeDisplay}>{formatClockTime(draftStart)}</Text>
                <TouchableOpacity style={styles.timeStepBtn} onPress={() => setDraftStart(s => s + STEP_MS)} activeOpacity={0.75}>
                  <Text style={styles.timeStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.editFieldLabel, { marginTop: 10 }]}>End time</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity style={styles.timeStepBtn} onPress={() => setDraftEnd(e => Math.max(e - STEP_MS, draftStart + STEP_MS))} activeOpacity={0.75}>
                  <Text style={styles.timeStepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.timeDisplay}>{formatClockTime(draftEnd)}</Text>
                <TouchableOpacity style={styles.timeStepBtn} onPress={() => setDraftEnd(e => e + STEP_MS)} activeOpacity={0.75}>
                  <Text style={styles.timeStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.editFieldLabel, { marginTop: 10 }]}>Event type</Text>
              <View style={styles.typeChips}>
                {EVENT_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, draftType === type && styles.typeChipActive]}
                    onPress={() => setDraftType(type)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.typeChipText, draftType === type && styles.typeChipTextActive]}>
                      {EVENT_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Footer actions */}
          <View style={styles.detailActions}>
            {editing ? (
              <View style={styles.editActionRow}>
                <TouchableOpacity style={styles.detailCancelBtn} onPress={cancelEdit} activeOpacity={0.82}>
                  <Text style={styles.detailCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailSaveBtn} onPress={saveAndClose} activeOpacity={0.82}>
                  <Text style={styles.detailSaveText}>Save changes</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.detailEditBtn}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.detailEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailDeleteBtn}
                  onPress={() => onDeleteEvent(event)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.detailDeleteText}>Delete event</Text>
                </TouchableOpacity>
                {linkedTodo ? (
                  <TouchableOpacity
                    style={styles.detailDeleteStrongBtn}
                    onPress={() => onDeleteEventAndTodo(event)}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.detailDeleteStrongText}>Delete event and to-do</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  allDayChipDone: { opacity: 0.58 },
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
    left: 62,
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
  eventGhost: {
    backgroundColor: 'rgba(138, 125, 99, 0.16)',
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    elevation: 0,
    shadowOpacity: 0,
    zIndex: 0,
  },
  eventBlockDone: { opacity: 0.58 },
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
  eventTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eventBlockTitle: { color: '#fff8f1', fontWeight: '700', fontSize: FONTS.size.sm, flex: 1 },
  eventBlockTitleDone: { textDecorationLine: 'line-through' },
  eventCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.brownLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  eventCheckboxLight: {
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  eventCheckboxDone: {
    backgroundColor: COLORS.brown,
    borderColor: COLORS.brown,
  },
  eventCheckmark: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
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
  weekEventDone: { opacity: 0.58 },
  weekEventTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  weekEventTitle: { color: COLORS.brown, fontSize: FONTS.size.sm, fontWeight: '600', flex: 1 },
  eventTitleDone: { textDecorationLine: 'line-through' },
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
  detailScrim: {
    flex: 1,
    backgroundColor: 'rgba(45, 36, 29, 0.28)',
    justifyContent: 'flex-end',
  },
  detailDismissArea: { flex: 1 },
  detailSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitleWrap: { flex: 1 },
  detailEyebrow: {
    color: COLORS.brownLight,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailTitle: {
    color: COLORS.brown,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseText: { color: COLORS.brown, fontSize: 16, fontWeight: '800' },
  detailRows: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  detailRowText: {
    color: COLORS.brownMid,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  linkedTodoRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    marginTop: 2,
  },
  linkedTodoText: {
    color: COLORS.brown,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  linkedTodoHint: {
    color: COLORS.red,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
    marginTop: 3,
  },
  detailActions: { gap: 10 },
  detailDeleteBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.white50,
  },
  detailDeleteText: {
    color: COLORS.brown,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  detailDeleteStrongBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.red,
  },
  detailDeleteStrongText: {
    color: '#fff7f1',
    fontSize: FONTS.size.sm,
    fontWeight: '800',
  },
  detailTitleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.brown,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailStatusToggle: {
    fontSize: FONTS.size.xs,
    color: COLORS.red,
    fontWeight: '700',
  },
  detailEditFields: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 14,
  },
  editFieldLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeStepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.brown,
    lineHeight: 22,
  },
  timeDisplay: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.brown,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  typeChipActive: {
    backgroundColor: COLORS.brown,
    borderColor: COLORS.brown,
  },
  typeChipText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brown,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: COLORS.bg,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.white50,
  },
  detailCancelText: {
    color: COLORS.brownLight,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  detailSaveBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.brown,
  },
  detailSaveText: {
    color: COLORS.bg,
    fontSize: FONTS.size.sm,
    fontWeight: '800',
  },
  detailEditBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.white50,
  },
  detailEditText: {
    color: COLORS.brown,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
});
