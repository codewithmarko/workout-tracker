'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  temperature = null;
  windspeed = null;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const date = this.date.toISOString();
    const split = date.split('-');
    const monthIndex = +split[1] - 1;
    const thisDay = split[2].slice(0, 2);
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[monthIndex]
    } ${thisDay}.`;
  }

  async _setWeather(coords) {
    const [lat, long] = coords;
    const APIURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,windspeed_10m&timezone=Europe%2FBerlin&forecast_days=1`;

    try {
      const response = await fetch(APIURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch weather data: ${response.status}`);
      }

      const data = await response.json();
      this.temperature = data.current.temperature_2m;
      this.windspeed = data.current.windspeed_10m;
    } catch (err) {
      throw err;
    }
  }

  async caller(coords) {
    try {
      await this._setWeather(coords);
    } catch (err) {
      console.error('An error occurred while fetching weather data:', err);
    }
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const containerWorkouts = document.querySelector('.workouts');
//Form
const workoutsList = document.querySelector('.workouts__container');
const form = document.querySelector('.form');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteWorkoutsBtn = document.querySelector('.workouts__delete-btn');

//Edit Form
const editForm = document.querySelector('.editForm');
const editFormTitle = document.querySelector('.form__editTitle');
const inputTypeEdit = document.querySelector('.form__input-e--type');
const inputDistanceEdit = document.querySelector('.form__input-e--distance');
const inputDurationEdit = document.querySelector('.form__input-e--duration');
const inputCadenceEdit = document.querySelector('.form__input-e--cadence');
const inputElevationEdit = document.querySelector('.form__input-e--elevation');
let editWorkoutButtons;

//Delete Popup
const popupLayer = document.querySelector('.popup__layer');
const popupDeleteAllBtnElm = document.querySelector('.popup__btn--danger');
const popupCancelBtnElm = document.querySelector('.popup__btn--neutral');

//Map loader
const mapLoadingLayer = document.querySelector('.map__loader');

let distanceEdited;
let durationEdited;
let cadenceEdited;
let workoutMarker;
let currentEditedWorkoutIndex;

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  markers = [];
  workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    //Toggles Button if no workouts saved
    this._showDeleteWorkoutsBtn();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    editForm.addEventListener('submit', this._safeEditedWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    inputTypeEdit.addEventListener('change', this._toggleElevationField);
    workoutsList.addEventListener(
      'click',
      this._containerWorkoutsEventDelegator.bind(this)
    );

    //Improve UX, delete all workouts
    deleteWorkoutsBtn.addEventListener('click', this._toggleDeletePopup);
    popupDeleteAllBtnElm.addEventListener(
      'click',
      this._deleteLocalStorage.bind(this)
    );
    popupCancelBtnElm.addEventListener('click', this._toggleDeletePopup);
  }

  _toggleDeletePopup() {
    popupLayer.classList.toggle('hidden');
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  async _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    const mapTheme =
      'https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png';

    L.tileLayer(mapTheme, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    console.log('GELADEN');
    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
    //Map loader
    setTimeout(() => {
      mapLoadingLayer.classList.add('hidden');
    }, 200);
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _showDeleteWorkoutsBtn() {
    this.workouts.length > 0
      ? deleteWorkoutsBtn.classList.remove('hidden')
      : deleteWorkoutsBtn.classList.add('hidden');
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        null;

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField(e) {
    if (e.target.classList.contains('form__input')) {
      inputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
      inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    } else {
      inputElevationEdit
        .closest('.form__row')
        .classList.toggle('form__row--hidden');

      inputCadenceEdit
        ?.closest('.form__row')
        .classList.toggle('form__row--hidden');
    }
  }

  async _newWorkout(e) {
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      const valid = this._inputValidation(type, distance, duration, cadence);
      if (!valid) return;
      workout = new Running([lat, lng], distance, duration, cadence);
      await workout.caller([lat, lng]);
    }

    //The issue was, that my workout was beeing rendered before the fetching was finished therefore the weather data could not be displayed properly

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      const valid = this._inputValidation(type, distance, duration, elevation);
      if (!valid) return;
      workout = new Cycling([lat, lng], distance, duration, elevation);
      await workout.caller([lat, lng]);
    }

    // Add new object to workout array
    this.workouts.push(workout);
    // Render workout on map as marker
    this._renderWorkoutMarker(workout);
    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();
    // Set local storage to all workouts
    this._setLocalStorage();
    this._showDeleteWorkoutsBtn();
  }

  _inputValidation(type, distance, duration, specialAtt) {
    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    if (
      !validInputs(distance, duration, specialAtt) ||
      !allPositive(distance, duration, type === 'running' ? specialAtt : 1)
    ) {
      return alert(`Inputs have to be positive numbers`);
    } else {
      return true;
    }
  }

  _renderWorkoutMarker(workout, checker = false) {
    workoutMarker = L.marker(workout.coords);
    workoutMarker
      .bindPopup(
        L.popup({
          maxWidth: 50,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      );

    //Checks if workout is beeing edited if true then old marker is being replaced in Array
    if (checker === true) {
      this.#map.removeLayer(this.markers[currentEditedWorkoutIndex]);
      this.markers.splice(currentEditedWorkoutIndex, 1);
      this.markers.splice(currentEditedWorkoutIndex, 0, workoutMarker);
    } else {
      this.markers.push(workoutMarker);
    }

    //Opens each marker on map
    this.markers.forEach((marker) => {
      this.#map.addLayer(marker);
      marker._icon.classList.add('marker');
      marker.openPopup();
    });
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <div class="workout__options">
    <div class="workout__edit"><svg xmlns="http://www.w3.org/0000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg></div>
    <div class="workout__delete">
    X
    </div>
    </div>
        <h2 class="workout__title">${workout.description}</h2>
        
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace?.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed?.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;

    html += `
        <div class="workout__details">
          <span class="workout__icon">☀️</span>
          <span class="workout__value">${workout.temperature}</span>
          <span class="workout__unit">°C</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">💨</span>
          <span class="workout__value">${workout.windspeed}</span>
          <span class="workout__unit">km/h</span>
        </div>
        </li>`;

    workoutsList.insertAdjacentHTML('beforeend', html);
  }

  _findWorkoutElSetWorkoutObj(e) {
    const result = {
      workoutEl: null,
      workout: null,
    };

    result.workoutEl = e.target.closest('.workout');

    if (result.workoutEl) {
      result.workout = this.workouts.find(
        (work) => work.id === result.workoutEl.dataset.id
      );
    }

    return result;
  }

  _moveToPopup(e) {
    if (!this.#map) return;
    const { workoutEl, workout } = this._findWorkoutElSetWorkoutObj(e);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _resetEditFormValues() {
    inputTypeEdit.value = null;
    inputDistanceEdit.value = null;
    inputDurationEdit.value = null;
    inputCadenceEdit.value = null;
    inputElevationEdit.value = null;
  }

  _editWorkout(e) {
    const { workoutEl, workout } = this._findWorkoutElSetWorkoutObj(e);

    this._resetEditFormValues();
    this._moveToPopup(e);

    const currentNodeIndex = this._findCurrentWorkoutIndexInParentNode(workout);
    currentEditedWorkoutIndex = this.workouts.indexOf(workout);

    //Reassign the values of current workout
    editFormTitle.innerHTML = `EDIT: ${workout.description}`;
    inputTypeEdit.value = workout.type;
    inputDistanceEdit.value = workout.distance;
    inputDurationEdit.value = workout.duration;
    inputCadenceEdit.value =
      workout.cadence === undefined ? '' : workout.cadence;
    inputElevationEdit.value =
      workout.elevationGain === undefined ? '' : workout.elevationGain;

    //Change settings of form depending on type
    editForm.style.backgroundColor = `${
      workout.type === 'cycling' ? '#ffb545' : '#00c46a'
    }`;
    this._checkCorrectEditForm(e, workout);
    this._showEditForm(currentNodeIndex);
    inputDistanceEdit.focus();
  }

  _findCurrentWorkoutIndexInParentNode(workout) {
    let currentIndex = -1;

    workoutsList.childNodes.forEach((node, index) => {
      if (node?.dataset?.id === workout.id) {
        currentIndex = index;
      }
    });

    if (currentIndex !== -1) {
      return currentIndex;
    } else {
      console.log(`Workout ID ${workout.id} could not be found.`);
    }
  }

  _safeEditedWorkout(e) {
    e.preventDefault();
    const currentWorkout = this.workouts[currentEditedWorkoutIndex];

    //Reassigning all values
    currentWorkout.type = inputTypeEdit.value;
    currentWorkout.distance = +inputDistanceEdit.value;
    currentWorkout.duration = +inputDurationEdit.value;
    if (currentWorkout.type === 'running') {
      currentWorkout.cadence = +inputCadenceEdit.value;
      currentWorkout.pace = currentWorkout.duration / currentWorkout.distance;
    }
    if (currentWorkout.type === 'cycling') {
      currentWorkout.elevationGain = +inputElevationEdit.value;
      currentWorkout.speed =
        currentWorkout.distance / (currentWorkout.duration / 60);
    }
    //Changing the description
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const split =
      typeof currentWorkout.date != 'string'
        ? currentWorkout.date.toISOString().split('-')
        : currentWorkout.date.split('-');
    const monthIndex = +split[1] - 1;
    const currentWorkoutDay = split[2].slice(0, 2);
    currentWorkout.description = `${currentWorkout.type[0].toUpperCase()}${currentWorkout.type.slice(
      1
    )} on ${months[monthIndex]} ${currentWorkoutDay}.`;

    editForm.classList.add('hidden');

    //Manipulate DOM
    for (const node of workoutsList.childNodes) {
      node?.dataset?.id === currentWorkout.id
        ? workoutsList.removeChild(node)
        : 'NOT FOUND';
    }

    this._renderWorkout(currentWorkout);
    this._setLocalStorage();

    //Change marker depending if workout is being edited or not
    this._renderWorkoutMarker(currentWorkout, true);
  }

  _checkCorrectEditForm(e, workout) {
    //Checks which type of workout and toggles the correct input field
    //TODO refactor
    if (
      workout.type === 'running' &&
      inputCadenceEdit
        .closest('.form__row')
        .classList.contains('form__row--hidden')
    ) {
      this._toggleElevationField(e);
    } else if (
      workout.type === 'cycling' &&
      inputElevationEdit
        .closest('.form__row')
        .classList.contains('form__row--hidden')
    ) {
      this._toggleElevationField(e);
    }
  }

  _showEditForm(workoutIndex) {
    workoutsList.insertBefore(editForm, workoutsList.childNodes[workoutIndex]);
    editForm.classList.remove('hidden');
  }

  _deleteWorkout(e) {
    const currWorkoutEl = e.target.closest('.workout');
    const deleteWorkout = this.workouts.find(
      (work) => work.id === currWorkoutEl.dataset.id
    );

    const deleteWorkoutIndex = this.workouts.indexOf(deleteWorkout);
    currWorkoutEl.style.display = 'none';

    //Remove workout and marker from arr
    this.workouts.splice(deleteWorkoutIndex, 1);
    this.markers.splice(deleteWorkoutIndex, 1);

    this.#map.removeLayer(this.markers[deleteWorkoutIndex]);
    this._setLocalStorage();
    this.workouts.length === 0 ? this._showDeleteWorkoutsBtn() : '';
  }

  _containerWorkoutsEventDelegator(e) {
    console.log('Event Delegator activated');
    if (e.target.classList.contains('workout')) {
      this._moveToPopup(e);
    } else if (e.target.classList.contains('workout__delete')) {
      this._deleteWorkout(e);
    } else if (e.target.closest('.workout__edit')) {
      this._editWorkout(e);
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.workouts = data;

    this.workouts.forEach((work) => {
      this._renderWorkout(work);
    });
  }

  _deleteLocalStorage() {
    if (this.workouts.length > 0) {
      this.reset();
    }
    this._toggleDeletePopup();
  }

  reset() {
    let workout = document.querySelectorAll('li');
    workout.forEach((work) => work.parentNode.removeChild(work));
    this.markers.forEach((marker) => marker.remove());
    this.workouts = [];
    this.markers = [];
    this.workouts.length === 0 ? this._showDeleteWorkoutsBtn() : '';
    localStorage.removeItem('workouts');
  }
}

const app = new App();
