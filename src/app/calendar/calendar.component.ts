import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, SystemJsNgModuleLoader } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

import { ChallengeService } from './../services/challenge.service';
import { WeekService } from '../services/week.service';
import { DataProcesingEvent } from '../../assets/models/Events';
import { Challenge, dummyChallenge, NiceTryChallenge } from './../../assets/models/Challenge';

import * as moment from 'moment';
import * as _ from 'lodash';

export interface CalendarDate {
  mDate: moment.Moment;
  selected?: boolean;
  today?: boolean;
}

moment.locale('es');

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit, OnChanges {
  currentDate = moment();
  dayNames = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];
  weeks: CalendarDate[][] = [];
  challengeDates: number[] = [];
  sortedDates: CalendarDate[] = [];
  selectedDays: Array<CalendarDate> = [];

  event1 = DataProcesingEvent;
  challenge: Challenge = dummyChallenge;
  exploitOngoing: boolean = true;

  $dateSelection: BehaviorSubject<CalendarDate> = new BehaviorSubject(null);

  @Input() selectedDates: CalendarDate[] = [];
  @Output() onSelectDate = new EventEmitter<CalendarDate>();

  constructor(
    public challengeService: ChallengeService,
    public weekService: WeekService
  ) {
    this.getChallenges();
    this.weekService.isTryingToExploit(new Date()).subscribe(isTrying => this.exploitOngoing = isTrying);

    this.$dateSelection.subscribe(datePicked => {
      this.weeks.forEach(week => {
        week.forEach(day => {
          if (day.mDate.isSame(datePicked.mDate)) {
            if (this.selectedDays.length >= 1) { this.selectedDays.pop().selected = false; }
            this.selectedDays = [];
            day.selected = true;
            this.selectedDays.push(day);
          }
        });
      });
    });
  }

  ngOnInit(): void {
    this.generateCalendar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedDates &&
        changes.selectedDates.currentValue &&
        changes.selectedDates.currentValue.length  > 1) {
      // sort on date changes for better performance when range checking
      this.sortedDates = _.sortBy(changes.selectedDates.currentValue, (m: CalendarDate) => m.mDate.valueOf());
      this.generateCalendar();
    }
  }

  // date checkers
  isToday(date: moment.Moment): boolean {
    return moment().isSame(moment(date), 'day');
  }

  isSelected(date: moment.Moment): boolean {
    return _.findIndex(this.selectedDates, (selectedDate) => {
      return moment(date).isSame(selectedDate.mDate, 'day');
    }) > -1;
  }

  isSelectedMonth(date: moment.Moment): boolean {
    return moment(date).isSame(this.currentDate, 'month');
  }

  selectDate(date: CalendarDate): void {
    if (this.retrieveSelection(date)) { return; }
    this.$dateSelection.next(date);
    // this.onSelectDate.emit(date); Scalable version
    if (this.exploitOngoing) {
      this.challenge = NiceTryChallenge;
      return;
    }

    this.weekService.sameWeekPeriod(date).subscribe( isSameWeek => {
      if (!isSameWeek) return;
      var hearChallenges: Subject<firebase.firestore.DocumentData> = this.challengeService.checkChallenges(date);
      
      hearChallenges.subscribe( data => {
        this.challenge = this.challengeService.formatChallenge(data);
      });
    });
  }

  retrieveSelection(datePicked: CalendarDate) {
    if (this.selectedDays.length < 1) { return; }
    this.challenge = dummyChallenge;
    const lastSelection: CalendarDate = this.selectedDays[this.selectedDays.length - 1];
    if (lastSelection.mDate.isSame(datePicked.mDate) && lastSelection.selected === true) {
      this.selectedDays.pop().selected = false;
      return true;
    }
    return false;
  }

  clearSelection() {
    if (this.selectedDays.length < 1) { return; }
    this.selectedDays.pop().selected = false;
    this.challenge = dummyChallenge;
  }

  getChallenges() {
    this.challengeService.getChallenges().subscribe(challenges => {
      this.challengeDates = [];
      challenges.forEach(challenge => this.challengeDates.push(challenge.date.seconds * 1000));
    });
  }

  // actions from calendar
  prevMonth(): void {
    this.clearSelection();
    this.currentDate = moment(this.currentDate).subtract(1, 'months');
    this.generateCalendar();
  }

  nextMonth(): void {
    this.clearSelection();
    this.currentDate = moment(this.currentDate).add(1, 'months');
    this.generateCalendar();
  }

  firstMonth(): void {
    this.currentDate = moment(this.currentDate).startOf('year');
    this.generateCalendar();
  }

  lastMonth(): void {
    this.currentDate = moment(this.currentDate).endOf('year');
    this.generateCalendar();
  }

  prevYear(): void {
    this.currentDate = moment(this.currentDate).subtract(1, 'year');
    this.generateCalendar();
  }

  nextYear(): void {
    this.currentDate = moment(this.currentDate).add(1, 'year');
    this.generateCalendar();
  }

  // generate the calendar grid
  generateCalendar(): void {
    const dates = this.fillDates(this.currentDate);
    const weeks: CalendarDate[][] = [];
    while (dates.length > 0) {
      weeks.push(dates.splice(0, 7));
    }
    this.weeks = weeks;
  }

  fillDates(currentMoment: moment.Moment): CalendarDate[] {
    const firstOfMonth = moment(currentMoment).startOf('month').day();
    const firstDayOfGrid = moment(currentMoment).startOf('month').subtract(firstOfMonth, 'days');
    const start = firstDayOfGrid.date();
    return _.range(start, start + 42)
            .map((date: number): CalendarDate => {
              const d = moment(firstDayOfGrid).date(date);
              return {
                today: this.isToday(d),
                selected: this.isSelected(d),
                mDate: d,
              };
            });
  }
  
  isChallengeDay(day: CalendarDate) {    
    return this.challengeDates.indexOf(day.mDate.toDate().getTime()) > -1;
  }
}
