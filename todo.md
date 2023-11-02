Done:
edit a workout //erledigt
delete a workout // erledigt
delete all workouts // erledigt, kleiner bug nur wenn leer ist
restlye App //erledigt
display weather for workout time and place

Todo in this order:
sort workouts by a certain field (e.g distance)
error and confirmation messages

Problem:
Wenn Workout Liste sortiert wird und anschließend ein Workout editiert und gespeichert wird, dann wird zwar das Workout editiert, aber ein anderer Marker aus der Liste wird gelöscht.

Bemerkung: Der Bug passiert erst, wenn ein Workout hinzugefügt wrid, sortiert und anschließend bearbeitet.

Workout hinzugefügt
Workout hinzugefügt
Sortiert
Workout editiert
--> bug

Idee:
Wir speichern den erstellten Marker im Workout Objekt und beheben so das Problem, dass zwei Arrays die Indexreihenfolge behalten müssen.
