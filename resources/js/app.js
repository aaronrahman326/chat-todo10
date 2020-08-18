require('./bootstrap');

window.Vue = require('vue');

Vue.component('rooms-component', require('./components/RoomsComponent.vue').default);
Vue.component('login-user-component', require('./components/LoginUserComponent.vue').default);
Vue.component('private-component', require('./components/PrivateComponent.vue').default);
Vue.component('sidebar-component', require('./components/SidebarComponent.vue').default);
Vue.component('groupformchat-component', require('./components/GroupFormChatComponent.vue').default);
Vue.component('chatmessages-component', require('./components/ChatMessagesComponent.vue').default);
Vue.component('navbar-component', require('./components/NavbarComponent.vue').default);
Vue.component('tabsroom-component', require('./components/TabsRoomComponent.vue').default);

if (window.location.origin == 'http://chat2.com-devel') {
    Vue.prototype.$backendURL = "http://chat2.com-devel";
} else {
    Vue.prototype.$backendURL = "https://customers.todo10.com/chat/public";
}

//Set from config/app.php -> timezone
Vue.prototype.$serverTimeZone = 'America/Mexico_City';
Date.prototype.addHours = function(h) {
    this.setTime(this.getTime() + (h*60*60*1000));
    return this;
}

import EchoLibrary from 'laravel-echo';
window.Pusher = require('pusher-js');
Pusher.logToConsole = true;

const app = new Vue({
    el: '#app-vue',
    data: {
        messages: [],
        current_room: 0,
        login_user: 0,
        sound_active: true,
        rooms: [],
        csrf: document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
        echoRun: false,
        timezone: null,
        offset_timezone: -1,
        connected_users: [],
    },
    mounted() {
        //Escucha los mensajes de Pusher
        if (this.login_user != 0) {
            this.echoListen();
            this.echoRun = true;
        }
    },
    created() {
        //Revisa si el usuario está logeado
        axios.get(this.$backendURL + '/api/checkLogin').then(response => {

            //SI NO ESTA ACTUALIZADO EL JSON DEL USER QUE SE LOGEE DE NUEVO
            if (response.data && response.data.user_id && response.data.timezone) {
                this.login_user = response.data.user_id;
                this.timezone = response.data.timezone;

                this.checkRoomId();

                this.checkRoomsUser();
            } else {
                $("#showModalLogin").modal("show");
            }
        });
    },
    methods: {
        //PRUEBA
        fetchMessages() {
            axios.get(this.$backendURL + '/chat/getMessages').then(response => {
                this.messages = response.data;
            });
        },
        //Añade un mensaje al chat grupal
        addMessage(message) {
            axios.post(this.$backendURL + '/chat/create', {
                user: this.login_user,
                room: this.current_room,
                message: message.message
            }).then(response => {
                this.messages.push(this.changeTimeZoneFormat(response.data));
            });
        },
        //Cambia estatus de activo o no el sonido
        setSoundActive(obj) {
            this.sound_active = obj.sound;
        },
        checkRoomId() {
            axios.get(this.$backendURL + '/api/checkRoom').then(response => {
                if (response.data && response.data != '') {
                    this.current_room = response.data;
                } else {
                    this.current_room = 1;
                }
            });

            //TEST
            this.fetchMessages();
        },
        checkRoomsUser() {
            axios.get(this.$backendURL + '/api/room/getFromUser').then(response => {
                if (response.data && response.data != '') {
                    this.rooms = response.data;
                }
            });
        },
        //Establece el ID del usuario logeado
        setLoginUser(user) {
            this.login_user = user.user_id;
            this.timezone = user.timezone;
        },
        setRoomUser(room) {
            let me = this;
            var exist = false;
            me.rooms.forEach(function (item, index, object) {
                if (item.id == room.room_id) {
                    exist = true;
                }
            });
            if (!exist) {
                axios.get(me.$backendURL + '/api/room/getRoom/' + room.room_id).then(response => {
                    if (response.data && response.data != '') {
                        me.rooms.push(response.data);
                    }
                });
            }
            me.current_room = room.room_id;
        },
        sounds() {
            let me = this;
            //Reproduce el audio cuando llega un mensaje
            if (me.sound_active) {
                let audio = new Audio(me.$backendURL + "/js/sounds/bell_ring.mp3");
                audio.play();
            }
        },
        changeCurrentRoom(room) {
            this.current_room = room.room_id;
        },
        deleteRoomFromUser(room) {
            let me = this;
            me.rooms.forEach(function (item, index, object) {
                if (item.id == room.room_id) {
                    if (me.current_room == room.room_id) {
                        me.current_room = 1;
                    }
                    object.splice(index, 1);
                    return;
                }
            });
        },
        echoListen() {
            window.Echo = new EchoLibrary({
                broadcaster: 'pusher',
                key: '236acea19ee8b3a3672a',
                cluster: 'us2',
                encrypted: false,
                forceTLS: false,
                authEndpoint: this.$backendURL + '/broadcast',
            });
            window.Echo.private('chat').listen('MessageSent', (e) => {
                let message = this.changeTimeZoneFormat(e);
                this.messages.push({
                        message: message.message,
                        user: message.user,
                        room: message.room,
                        date: message.date
                });
                this.sounds();
            });
        },
        setConnectedUsers(users) {
            this.connected_users = users.users;
        },
        changeTimeZoneFormat(data) {
            var date = new Date(Date.parse(data.date));
            if (this.offset_timezone != -1) {
                date.addHours(this.offset_timezone);
            }
            date = date.getFullYear() + "-"
                + ((date.getMonth()+1)<10?'0':'') + (date.getMonth()+1) + "-"
                + (date.getDate()<10?'0':'') + date.getDate() + " "
                + (date.getHours()<10?'0':'') + date.getHours() + ":"
                + (date.getMinutes()<10?'0':'') + date.getMinutes() + ":"
                + (date.getSeconds()<10?'0':'') + date.getSeconds();
            data.date = date;
            return data;
        }
    },
    watch: {
        login_user: function (value) {
            if (value == 0) {
                $("#showModalLogin").modal("show");
            } else {
                if (!this.echoRun) {
                    this.echoListen();
                    this.echoRun = true;
                }
                
                this.checkRoomId();

                this.checkRoomsUser();

                $("#showModalRooms").modal("show");
            }
        },
        timezone: function (value) {
            axios.post(this.$backendURL + '/api/offsetTimezone', {
                _token: this.csrf,
                tz1: value,
                tz2: this.$serverTimeZone,
            }).then((response) => {
                if (response.data) {
                    this.offset_timezone = response.data;
                } else {
                    this.offset_timezone = -1;
                }
            });
        },
        offset_timezone: function (value) {
            let me = this;
            me.messages.forEach(function (item, index, object) {
                item = me.changeTimeZoneFormat(item);
            });
        },
    }
});