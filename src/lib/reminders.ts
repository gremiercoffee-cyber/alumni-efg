import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'todo-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationSetup(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'To-do reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
}

export async function requestReminderPermissions(): Promise<boolean> {
  await ensureNotificationSetup();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleTodoReminder(
  title: string,
  body: string,
  reminderAt: number,
  listId: string,
  folderId: string
): Promise<string> {
  await ensureNotificationSetup();
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: {
        url: `com.gremier.notekeeper://todo?listId=${encodeURIComponent(listId)}&folderId=${encodeURIComponent(folderId)}`,
        listId,
        folderId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderAt),
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
}

export async function cancelTodoReminder(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('cancelScheduledNotificationAsync failed', error);
  }
}

export function attachNotificationOpener(
  openUrl: (url: string) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') {
      openUrl(url);
    }
  });

  Notifications.getLastNotificationResponseAsync().then(response => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') {
      openUrl(url);
    }
  });
  return () => {
    sub.remove();
  };
}
