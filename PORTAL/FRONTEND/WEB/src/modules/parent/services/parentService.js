import api from '../../../shared/api/api';

function responseData(response, endpoint) {
  if (response?.success === false) {
    throw new Error(response.error?.message || `The ${endpoint} request was not successful.`);
  }
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

function recordList(response, endpoint) {
  const data = responseData(response, endpoint);
  if (data == null) return [];
  if (!Array.isArray(data)) {
    throw new Error(`The ${endpoint} response did not contain a valid record list.`);
  }
  return data;
}

const parentService = {
  async getNotifications({ signal } = {}) {
    const response = await api.get('/college/notifications', { signal });
    return recordList(response, 'notifications');
  },

  async getUnreadNotificationCount({ signal } = {}) {
    const response = await api.get('/college/notifications/unread-count', { signal });
    const data = responseData(response, 'unread notification count');
    if (!data || !Number.isInteger(data.count) || data.count < 0) {
      throw new Error('The unread notification count response was invalid.');
    }
    return data.count;
  },

  async markNotificationRead(notificationId) {
    if (!notificationId) throw new Error('A notification ID is required.');
    const response = await api.patch(
      `/college/notifications/${encodeURIComponent(notificationId)}/read`
    );
    return responseData(response, 'mark notification as read');
  },

  async getTodayMessMenu({ signal } = {}) {
    const response = await api.get('/college/mess/today', { signal });
    return recordList(response, "today's mess menu");
  },
};

export default parentService;
